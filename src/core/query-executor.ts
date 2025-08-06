import { ContentstackClient, sanitizePath } from '@contentstack/cli-utilities';
import * as path from 'path';
import { QueryExportConfig, Modules } from '../types';
import { QueryParser } from '../utils/query-parser';
import { ModuleExporter } from './module-exporter';
import { log } from '../utils/logger';
import { ReferencedContentTypesHandler } from '../utils';
import { fsUtil } from '../utils';
import { ContentTypeDependenciesHandler } from '../utils';
import { AssetReferenceHandler } from '../utils';

export class QueryExporter {
  private stackAPIClient: ReturnType<ContentstackClient['stack']>;
  private exportQueryConfig: QueryExportConfig;
  private queryParser: QueryParser;
  private moduleExporter: ModuleExporter;

  constructor(managementAPIClient: ContentstackClient, exportQueryConfig: QueryExportConfig) {
    this.exportQueryConfig = exportQueryConfig;

    this.stackAPIClient = managementAPIClient.stack({
      api_key: exportQueryConfig.stackApiKey,
      management_token: exportQueryConfig.managementToken,
    });
    // Initialize components
    this.queryParser = new QueryParser(this.exportQueryConfig);
    this.moduleExporter = new ModuleExporter(exportQueryConfig);
  }

  async execute(): Promise<void> {
    log(this.exportQueryConfig, 'Starting query-based export...', 'info');

    // Step 1: Parse and validate query
    const parsedQuery = await this.queryParser.parse(this.exportQueryConfig.query);
    log(this.exportQueryConfig, 'Query parsed and validated successfully', 'success');

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
      log(this.exportQueryConfig, 'No content types found, skipping export', 'info');
      process.exit(0);
    }

    // Step 5: export other content types which are referenced in previous step
    await this.exportReferencedContentTypes();
    // Step 6: export dependent modules global fields, extensions, taxonomies
    await this.exportDependentModules();
    // Step 7: export content modules entries, assets
    await this.exportContentModules();
    // Step 9: export all other modules

    log(this.exportQueryConfig, 'Query-based export completed successfully!', 'success');
  }

  // export general modules
  private async exportGeneralModules(): Promise<void> {
    log(this.exportQueryConfig, 'Exporting general modules...', 'info');

    for (const module of this.exportQueryConfig.modules.general) {
      await this.moduleExporter.exportModule(module);
    }
  }

  private async exportQueriedModule(parsedQuery: any): Promise<void> {
    for (const [moduleName] of Object.entries(parsedQuery.modules)) {
      const module = moduleName as Modules;

      if (!this.exportQueryConfig.modules.queryable.includes(module)) {
        log(this.exportQueryConfig, `Module "${module}" is not queryable`, 'error');
        continue;
      }

      log(this.exportQueryConfig, `Exporting ${moduleName} with query...`, 'info');
      // Export the queried module
      await this.moduleExporter.exportModule(module, { query: parsedQuery });
    }
  }

  private async exportReferencedContentTypes(): Promise<void> {
    log(this.exportQueryConfig, 'Starting export of referenced content types...', 'info');

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
        log(this.exportQueryConfig, 'No content types found, skipping referenced content types export', 'info');
        return;
      }

      // Step 2: Start with initial batch (all currently exported content types)
      let currentBatch = [...contentTypes];

      log(this.exportQueryConfig, `Starting with ${currentBatch.length} initial content types`, 'info');

      // track reference depth
      let iterationCount = 0;
      // Step 3: Process batches until no new references are found
      while (currentBatch.length > 0 && iterationCount < this.exportQueryConfig.maxCTReferenceDepth) {
        iterationCount++;
        currentBatch.forEach((ct: any) => exportedContentTypeUIDs.add(ct.uid));
        // Extract referenced content types from current batch
        const referencedUIDs = await referencedHandler.extractReferencedContentTypes(currentBatch);

        // Filter out already exported content types
        const newReferencedUIDs = referencedUIDs.filter((uid: string) => !exportedContentTypeUIDs.has(uid));

        if (newReferencedUIDs.length > 0) {
          log(
            this.exportQueryConfig,
            `Found ${newReferencedUIDs.length} new referenced content types to fetch`,
            'info',
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

          log(this.exportQueryConfig, `Fetched ${currentBatch.length} new content types for next iteration`, 'info');
        } else {
          log(this.exportQueryConfig, 'No new referenced content types found, stopping recursion', 'info');
          break;
        }
      }

      fsUtil.writeFile(sanitizePath(contentTypesFilePath), contentTypes);
      log(this.exportQueryConfig, 'Referenced content types export completed successfully', 'success');
    } catch (error) {
      log(this.exportQueryConfig, `Error exporting referenced content types: ${error.message}`, 'error');
      throw error;
    }
  }

  private async exportDependentModules(): Promise<void> {
    log(this.exportQueryConfig, 'Starting export of dependent modules...', 'info');

    try {
      const dependenciesHandler = new ContentTypeDependenciesHandler(this.stackAPIClient, this.exportQueryConfig);

      // Extract dependencies from all exported content types
      const dependencies = await dependenciesHandler.extractDependencies();

      // Export Global Fields
      if (dependencies.globalFields.size > 0) {
        const globalFieldUIDs = Array.from(dependencies.globalFields);
        log(this.exportQueryConfig, `Exporting ${globalFieldUIDs.length} global fields...`, 'info');

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
        log(this.exportQueryConfig, `Exporting ${extensionUIDs.length} extensions...`, 'info');

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
        log(this.exportQueryConfig, `Exporting ${marketplaceAppInstallationUIDs.length} marketplace apps...`, 'info');
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
        log(this.exportQueryConfig, `Exporting ${taxonomyUIDs.length} taxonomies...`, 'info');

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

      log(this.exportQueryConfig, 'Dependent modules export completed successfully', 'success');
    } catch (error) {
      log(this.exportQueryConfig, `Error exporting dependent modules: ${error.message}`, 'error');
      throw error;
    }
  }

  private async exportContentModules(): Promise<void> {
    log(this.exportQueryConfig, 'Starting export of content modules...', 'info');

    try {
      // Step 1: Export entries for all exported content types
      await this.exportEntries();

      // Step 2: Export referenced assets from entries
      // add a delay of 5 seconds
      const delay = (this.exportQueryConfig as any).exportDelayMs || 5000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      await this.exportReferencedAssets();

      log(this.exportQueryConfig, 'Content modules export completed successfully', 'success');
    } catch (error) {
      log(this.exportQueryConfig, `Error exporting content modules: ${error.message}`, 'error');
      throw error;
    }
  }

  private async exportEntries(): Promise<void> {
    log(this.exportQueryConfig, 'Exporting entries...', 'info');

    try {
      // Export entries - module exporter will automatically read exported content types
      // and export entries for all of them
      await this.moduleExporter.exportModule('entries');

      log(this.exportQueryConfig, 'Entries export completed successfully', 'success');
    } catch (error) {
      log(this.exportQueryConfig, `Error exporting entries: ${error.message}`, 'error');
      throw error;
    }
  }

  private async exportReferencedAssets(): Promise<void> {
    log(this.exportQueryConfig, 'Starting export of referenced assets...', 'info');

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
      const assetUIDs = assetHandler.extractReferencedAssets();

      if (assetUIDs.length > 0) {
        log(this.exportQueryConfig, `Found ${assetUIDs.length} referenced assets to export`, 'info');

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
        log(this.exportQueryConfig, `Processing assets in ${totalBatches} batches of ${batchSize}`, 'info');

        // Process assets in batches
        for (let i = 0; i < 2; i++) {
          const start = i * batchSize;
          const end = Math.min(start + batchSize, assetUIDs.length);
          const batchAssetUIDs = assetUIDs.slice(start, end);

          log(
            this.exportQueryConfig,
            `Exporting batch ${i + 1}/${totalBatches} (${batchAssetUIDs.length} assets)...`,
            'info',
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
            log(this.exportQueryConfig, `Initialized temporary files with first batch data`, 'info');
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

            log(this.exportQueryConfig, `Updated temporary files with batch ${i + 1} data`, 'info');
          }

          // Optional: Add delay between batches to avoid rate limiting
          if (i < totalBatches - 1 && this.exportQueryConfig.batchDelayMs) {
            log(
              this.exportQueryConfig,
              `Waiting ${this.exportQueryConfig.batchDelayMs}ms before next batch...`,
              'info',
            );
            await new Promise((resolve) => setTimeout(resolve, this.exportQueryConfig.batchDelayMs));
          }
        }

        // After all batches are processed, copy temp files back to original files
        const finalMetadata = fsUtil.readFile(sanitizePath(tempMetadataFilePath));
        const finalAssets = fsUtil.readFile(sanitizePath(tempAssetFilePath));

        fsUtil.writeFile(sanitizePath(metadataFilePath), finalMetadata);
        fsUtil.writeFile(sanitizePath(assetFilePath), finalAssets);

        log(this.exportQueryConfig, `Final data written back to original files`, 'info');

        // Clean up temp files
        fsUtil.removeFile(sanitizePath(tempMetadataFilePath));
        fsUtil.removeFile(sanitizePath(tempAssetFilePath));

        log(this.exportQueryConfig, `Temporary files cleaned up`, 'info');
        log(this.exportQueryConfig, 'Referenced assets exported successfully', 'success');
      } else {
        log(this.exportQueryConfig, 'No referenced assets found in entries', 'info');
      }
    } catch (error) {
      log(this.exportQueryConfig, `Error exporting referenced assets: ${error.message}`, 'error');
      throw error;
    }
  }
}
