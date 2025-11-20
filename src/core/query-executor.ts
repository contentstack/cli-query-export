import { ContentstackClient, sanitizePath, log } from '@contentstack/cli-utilities';
import * as path from 'path';
import { QueryExportConfig, Modules } from '../types';
import { QueryParser } from '../utils/query-parser';
import { ModuleExporter } from './module-exporter';
import { createLogContext } from '../utils/logger';
import { ReferencedContentTypesHandler } from '../utils';
import { fsUtil } from '../utils';
import { ContentTypeDependenciesHandler } from '../utils';
import { AssetReferenceHandler } from '../utils';

export class QueryExporter {
  private stackAPIClient: ReturnType<ContentstackClient['stack']>;
  private exportQueryConfig: QueryExportConfig;
  private queryParser: QueryParser;
  private moduleExporter: ModuleExporter;
  private logContext: any;

  constructor(managementAPIClient: ContentstackClient, exportQueryConfig: QueryExportConfig) {
    this.exportQueryConfig = exportQueryConfig;
    this.logContext = createLogContext(exportQueryConfig);

    this.stackAPIClient = managementAPIClient.stack({
      api_key: exportQueryConfig.stackApiKey,
      management_token: exportQueryConfig.managementToken,
    });
    // Initialize components
    this.queryParser = new QueryParser(this.exportQueryConfig);
    this.moduleExporter = new ModuleExporter(exportQueryConfig);
  }

  async execute(): Promise<void> {
    log.info('Starting query-based export...', this.logContext);

    // Step 1: Parse and validate query
    log.debug('Parsing and validating query', this.logContext);
    const parsedQuery = await this.queryParser.parse(this.exportQueryConfig.query);
    log.info('Query parsed and validated successfully', this.logContext);

    // Step 2: Always export general modules
    await this.exportGeneralModules();

    // Step 4: Export queried modules
    await this.exportQueriedModule(parsedQuery);

    // Step 1: Read initial content types and mark them as exported
    const contentTypesFilePath = path.join(
      sanitizePath(this.exportQueryConfig.exportDir),
      sanitizePath(this.exportQueryConfig.branchName || ''),
      'content_types',
      'schema.json',
    );
    const contentTypes: any = fsUtil.readFile(sanitizePath(contentTypesFilePath)) || [];
    if (contentTypes.length === 0) {
      log.info('No content types found, skipping export', this.logContext);
      process.exit(0);
    }

    // Step 5: export other content types which are referenced in previous step
    log.debug('Starting referenced content types export', this.logContext);
    await this.exportReferencedContentTypes();
    // Step 6: export dependent modules global fields, extensions, taxonomies
    log.debug('Starting dependent modules export', this.logContext);
    await this.exportDependentModules();
    // Step 7: export content modules entries, assets
    log.debug('Starting content modules export', this.logContext);
    await this.exportContentModules();
    // Step 9: export all other modules

    log.info('Query-based export completed successfully!', this.logContext);
  }

  // export general modules
  private async exportGeneralModules(): Promise<void> {
    log.info('Exporting general modules...', this.logContext);

    for (const module of this.exportQueryConfig.modules.general) {
      await this.moduleExporter.exportModule(module);
    }
  }

  private async exportQueriedModule(parsedQuery: any): Promise<void> {
    log.debug('Starting queried module export', this.logContext);
    for (const [moduleName] of Object.entries(parsedQuery.modules)) {
      const module = moduleName as Modules;

      if (!this.exportQueryConfig.modules.queryable.includes(module)) {
        log.error(`Module "${module}" is not queryable`, this.logContext);
        continue;
      }

      log.info(`Exporting ${moduleName} with query...`, this.logContext);
      // Export the queried module
      await this.moduleExporter.exportModule(module, { query: parsedQuery });
    }
    log.debug('Queried module export completed', this.logContext);
  }

  private async exportReferencedContentTypes(): Promise<void> {
    log.info('Starting export of referenced content types...', this.logContext);

    try {
      const referencedHandler = new ReferencedContentTypesHandler(this.exportQueryConfig);
      const exportedContentTypeUIDs: Set<string> = new Set();

      // Step 1: Read initial content types and mark them as exported
      const contentTypesFilePath = path.join(
        sanitizePath(this.exportQueryConfig.exportDir),
        sanitizePath(this.exportQueryConfig.branchName || ''),
        'content_types',
        'schema.json',
      );
      const contentTypes: any = fsUtil.readFile(sanitizePath(contentTypesFilePath)) || [];
      if (contentTypes.length === 0) {
        log.info('No content types found, skipping referenced content types export', this.logContext);
        return;
      }

      // Step 2: Start with initial batch (all currently exported content types)
      let currentBatch = [...contentTypes];

      log.info(`Starting with ${currentBatch.length} initial content types`, this.logContext);

      // track reference depth
      let iterationCount = 0;
      // Step 3: Process batches until no new references are found
      while (currentBatch.length > 0 && iterationCount < this.exportQueryConfig.maxCTReferenceDepth) {
        iterationCount++;
        log.debug(`Processing referenced content types iteration ${iterationCount}`, this.logContext);
        currentBatch.forEach((ct: any) => exportedContentTypeUIDs.add(ct.uid));
        // Extract referenced content types from current batch
        const referencedUIDs = await referencedHandler.extractReferencedContentTypes(currentBatch);

        // Filter out already exported content types
        const newReferencedUIDs = referencedUIDs.filter((uid: string) => !exportedContentTypeUIDs.has(uid));

        if (newReferencedUIDs.length > 0) {
          log.info(
            `Found ${newReferencedUIDs.length} new referenced content types to fetch`,
            this.logContext,
          );

          // // Add to exported set to avoid duplicates in future iterations
          // newReferencedUIDs.forEach((uid) => exportedContentTypeUIDs.add(uid));

          // Step 4: Fetch new content types using moduleExporter
          const query = {
            modules: {
              'content-types': {
                uid: {
                  $in: newReferencedUIDs,
                },
              },
            },
          };

          await this.moduleExporter.exportModule('content-types', { query });

          const newContentTypes = fsUtil.readFile(sanitizePath(contentTypesFilePath)) as any[];
          currentBatch = [...newContentTypes];

          // Push new content types to main array
          contentTypes.push(...newContentTypes);

          log.info(`Fetched ${currentBatch.length} new content types for next iteration`, this.logContext);
        } else {
          log.info('No new referenced content types found, stopping recursion', this.logContext);
          break;
        }
      }

      fsUtil.writeFile(sanitizePath(contentTypesFilePath), contentTypes);
      log.success('Referenced content types export completed successfully', this.logContext);
    } catch (error) {
      log.error(`Error exporting referenced content types: ${error.message}`, this.logContext);
      throw error;
    }
  }

  private async exportDependentModules(): Promise<void> {
    log.info('Starting export of dependent modules...', this.logContext);

    try {
      const dependenciesHandler = new ContentTypeDependenciesHandler(this.stackAPIClient, this.exportQueryConfig);

      // Extract dependencies from all exported content types
      const dependencies = await dependenciesHandler.extractDependencies();
      log.debug('Dependencies extracted successfully', this.logContext);

      // Export Global Fields
      if (dependencies.globalFields.size > 0) {
        const globalFieldUIDs = Array.from(dependencies.globalFields);
        log.info(`Exporting ${globalFieldUIDs.length} global fields...`, this.logContext);

        const query = {
          modules: {
            'global-fields': {
              uid: { $in: globalFieldUIDs },
            },
          },
        };
        await this.moduleExporter.exportModule('global-fields', { query });
      }

      // Export Extensions
      if (dependencies.extensions.size > 0) {
        const extensionUIDs = Array.from(dependencies.extensions);
        log.info(`Exporting ${extensionUIDs.length} extensions...`, this.logContext);

        const query = {
          modules: {
            extensions: {
              uid: { $in: extensionUIDs },
            },
          },
        };
        await this.moduleExporter.exportModule('extensions', { query });
      }

      // export marketplace apps
      if (dependencies.marketplaceApps.size > 0) {
        const marketplaceAppInstallationUIDs = Array.from(dependencies.marketplaceApps);
        log.info(`Exporting ${marketplaceAppInstallationUIDs.length} marketplace apps...`, this.logContext);
        const query = {
          modules: {
            'marketplace-apps': {
              installation_uid: { $in: marketplaceAppInstallationUIDs },
            },
          },
        };
        await this.moduleExporter.exportModule('marketplace-apps', { query });
      }

      // Export Taxonomies
      if (dependencies.taxonomies.size > 0) {
        const taxonomyUIDs = Array.from(dependencies.taxonomies);
        log.info(`Exporting ${taxonomyUIDs.length} taxonomies...`, this.logContext);

        const query = {
          modules: {
            taxonomies: {
              uid: { $in: taxonomyUIDs },
            },
          },
        };
        await this.moduleExporter.exportModule('taxonomies', { query });
      }

      // export personalize
      await this.moduleExporter.exportModule('personalize');

      log.success('Dependent modules export completed successfully', this.logContext);
    } catch (error) {
      log.error(`Error exporting dependent modules: ${error.message}`, this.logContext);
      throw error;
    }
  }

  private async exportContentModules(): Promise<void> {
    log.info('Starting export of content modules...', this.logContext);

    try {
      // Step 1: Export entries for all exported content types
      await this.exportEntries();

      // Step 2: Export referenced assets from entries
      // add a delay of 5 seconds
      const delay = (this.exportQueryConfig as any).exportDelayMs || 5000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      await this.exportReferencedAssets();

      log.info('Content modules export completed successfully', this.logContext);
    } catch (error) {
      log.error(`Error exporting content modules: ${error.message}`, this.logContext);
      throw error;
    }
  }

  private async exportEntries(): Promise<void> {
    log.info('Exporting entries...', this.logContext);

    try {
      // Export entries - module exporter will automatically read exported content types
      // and export entries for all of them
      await this.moduleExporter.exportModule('entries');

      log.success('Entries export completed successfully', this.logContext);
    } catch (error) {
      log.error(`Error exporting entries: ${error.message}`, this.logContext);
      throw error;
    }
  }

  private async exportReferencedAssets(): Promise<void> {
    log.info('Starting export of referenced assets...', this.logContext);

    try {
      const assetsDir = path.join(
        sanitizePath(this.exportQueryConfig.exportDir),
        sanitizePath(this.exportQueryConfig.branchName || ''),
        'assets',
      );

      const metadataFilePath = path.join(assetsDir, 'metadata.json');
      const assetFilePath = path.join(assetsDir, 'assets.json');

      // Define temp file paths
      const tempMetadataFilePath = path.join(assetsDir, 'metadata_temp.json');
      const tempAssetFilePath = path.join(assetsDir, 'assets_temp.json');

      const assetHandler = new AssetReferenceHandler(this.exportQueryConfig);

      // Extract referenced asset UIDs from all entries
      log.debug('Extracting referenced assets from entries', this.logContext);
      const assetUIDs = assetHandler.extractReferencedAssets();

      if (assetUIDs.length > 0) {
        log.info(`Found ${assetUIDs.length} referenced assets to export`, this.logContext);

        // Define batch size - can be configurable through exportQueryConfig
        const batchSize = this.exportQueryConfig.assetBatchSize || 100;

        if (assetUIDs.length <= batchSize) {
          const query = {
            modules: {
              assets: {
                uid: { $in: assetUIDs },
              },
            },
          };

          await this.moduleExporter.exportModule('assets', { query });
        }

        // if asset size is bigger than batch size, then we need to export in batches
        // Calculate number of batches
        const totalBatches = Math.ceil(assetUIDs.length / batchSize);
        log.info(`Processing assets in ${totalBatches} batches of ${batchSize}`, this.logContext);

        // Process assets in batches
        for (let i = 0; i < totalBatches; i++) {
          const start = i * batchSize;
          const end = Math.min(start + batchSize, assetUIDs.length);
          const batchAssetUIDs = assetUIDs.slice(start, end);

          log.info(
            `Exporting batch ${i + 1}/${totalBatches} (${batchAssetUIDs.length} assets)...`,
            this.logContext,
          );

          const query = {
            modules: {
              assets: {
                uid: { $in: batchAssetUIDs },
              },
            },
          };

          await this.moduleExporter.exportModule('assets', { query });

          // Read the current batch's metadata.json and assets.json files
          const currentMetadata: any = fsUtil.readFile(sanitizePath(metadataFilePath));
          const currentAssets: any = fsUtil.readFile(sanitizePath(assetFilePath));

          // Check if this is the first batch
          if (i === 0) {
            // For first batch, initialize temp files with current content
            fsUtil.writeFile(sanitizePath(tempMetadataFilePath), currentMetadata);
            fsUtil.writeFile(sanitizePath(tempAssetFilePath), currentAssets);
            log.info(`Initialized temporary files with first batch data`, this.logContext);
          } else {
            // For subsequent batches, append to temp files with incremented keys

            // Handle metadata (which contains arrays of asset info)
            const tempMetadata: any = fsUtil.readFile(sanitizePath(tempMetadataFilePath)) || {};

            // Merge metadata by combining arrays
            if (currentMetadata) {
              Object.keys(currentMetadata).forEach((key: string) => {
                if (!tempMetadata[key]) {
                  tempMetadata[key] = currentMetadata[key];
                }
              });
            }

            // Write updated metadata back to temp file
            fsUtil.writeFile(sanitizePath(tempMetadataFilePath), tempMetadata);

            // Handle assets (which is an object with numeric keys)
            const tempAssets: any = fsUtil.readFile(sanitizePath(tempAssetFilePath)) || {};
            let nextIndex = Object.keys(tempAssets).length + 1;

            // Add current assets with incremented keys
            Object.values(currentAssets).forEach((value: any) => {
              tempAssets[nextIndex.toString()] = value;
              nextIndex++;
            });

            fsUtil.writeFile(sanitizePath(tempAssetFilePath), tempAssets);

            log.info(`Updated temporary files with batch ${i + 1} data`, this.logContext);
          }

          // Optional: Add delay between batches to avoid rate limiting
          if (i < totalBatches - 1 && this.exportQueryConfig.batchDelayMs) {
            await new Promise((resolve) => setTimeout(resolve, this.exportQueryConfig.batchDelayMs));
          }
        }

        // After all batches are processed, copy temp files back to original files
        const finalMetadata = fsUtil.readFile(sanitizePath(tempMetadataFilePath));
        const finalAssets = fsUtil.readFile(sanitizePath(tempAssetFilePath));

        fsUtil.writeFile(sanitizePath(metadataFilePath), finalMetadata);
        fsUtil.writeFile(sanitizePath(assetFilePath), finalAssets);

        log.info(`Final data written back to original files`, this.logContext);

        // Clean up temp files
        fsUtil.removeFile(sanitizePath(tempMetadataFilePath));
        fsUtil.removeFile(sanitizePath(tempAssetFilePath));

        log.info(`Temporary files cleaned up`, this.logContext);
        log.success('Referenced assets exported successfully', this.logContext);
      } else {
        log.info('No referenced assets found in entries', this.logContext);
      }
    } catch (error) {
      log.error(`Error exporting referenced assets: ${error.message}`, this.logContext);
      throw error;
    }
  }
}
