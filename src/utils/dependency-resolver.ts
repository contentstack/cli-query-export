import * as path from 'path';
import { QueryExportConfig } from '../types';
import { fsUtil } from './index';
import { ContentstackClient, sanitizePath } from '@contentstack/cli-utilities';
import { log } from './logger';

export class ContentTypeDependenciesHandler {
  private exportQueryConfig: QueryExportConfig;
  private stackAPIClient: ReturnType<ContentstackClient['stack']>;

  constructor(stackAPIClient: any, exportQueryConfig: QueryExportConfig) {
    this.exportQueryConfig = exportQueryConfig;
    this.stackAPIClient = stackAPIClient;
  }

  async extractDependencies(): Promise<{
    globalFields: Set<string>;
    extensions: Set<string>;
    taxonomies: Set<string>;
    marketplaceApps: Set<string>;
  }> {
    const contentTypesFilePath = path.join(
      sanitizePath(this.exportQueryConfig.exportDir),
      sanitizePath(this.exportQueryConfig.branchName || ''),
      'content_types',
      'schema.json',
    );
    const allContentTypes = (fsUtil.readFile(sanitizePath(contentTypesFilePath)) as any[]) || [];
    if (allContentTypes.length === 0) {
      log(this.exportQueryConfig, 'No content types found, skipping dependency extraction', 'info');
      return {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
        marketplaceApps: new Set<string>(),
      };
    }

    log(this.exportQueryConfig, `Extracting dependencies from ${allContentTypes.length} content types`, 'info');

    const dependencies = {
      globalFields: new Set<string>(),
      extensions: new Set<string>(),
      taxonomies: new Set<string>(),
      marketplaceApps: new Set<string>(),
    };

    for (const contentType of allContentTypes) {
      if (contentType.schema) {
        this.traverseSchemaForDependencies(contentType.schema, dependencies);
      }
    }

    // Separate extensions from marketplace apps using the extracted extension UIDs
    if (dependencies.extensions.size > 0) {
      const extensionUIDs = Array.from(dependencies.extensions);
      log(
        this.exportQueryConfig,
        `Processing ${extensionUIDs.length} extensions to identify marketplace apps...`,
        'info',
      );

      try {
        const { extensions, marketplaceApps } = await this.fetchExtensionsAndMarketplaceApps(extensionUIDs);
        dependencies.extensions = new Set(extensions);
        dependencies.marketplaceApps = new Set(marketplaceApps);
        log(
          this.exportQueryConfig,
          `Dependencies separated - Global Fields: ${dependencies.globalFields.size}, Extensions: ${dependencies.extensions.size}, Taxonomies: ${dependencies.taxonomies.size}, Marketplace Apps: ${dependencies.marketplaceApps.size}`,
          'info',
        );
      } catch (error) {
        log(this.exportQueryConfig, `Error separating extensions and marketplace apps: ${error.message}`, 'error');
        // Keep original extensions if separation fails
      }
    } else {
      log(
        this.exportQueryConfig,
        `Found dependencies - Global Fields: ${dependencies.globalFields.size}, Extensions: ${dependencies.extensions.size}, Taxonomies: ${dependencies.taxonomies.size}, Marketplace Apps: ${dependencies.marketplaceApps.size}`,
        'info',
      );
    }

    return dependencies;
  }

  // Update the fetchExtensionsAndMarketplaceApps method to only fetch specific extension UIDs
  async fetchExtensionsAndMarketplaceApps(
    extensionUIDs: string[],
  ): Promise<{ extensions: string[]; marketplaceApps: string[] }> {
    log(
      this.exportQueryConfig,
      `Fetching details for ${extensionUIDs.length} extensions to identify marketplace apps...`,
      'info',
    );

    try {
      // Query parameters to include marketplace extensions
      const queryParams = {
        include_count: true,
        include_marketplace_extensions: true,
        query: {
          uid: { $in: extensionUIDs },
        },
      };

      // Fetch all extensions including marketplace apps
      const response = await this.stackAPIClient.extension().query(queryParams).find();

      if (!response || !response.items) {
        log(this.exportQueryConfig, `No extensions found`, 'warn');
        return { extensions: extensionUIDs, marketplaceApps: [] };
      }

      const marketplaceApps: string[] = [];
      const regularExtensions: string[] = [];

      response.items.forEach((item: any) => {
        if (item.app_uid && item.app_installation_uid) {
          marketplaceApps.push(item.app_installation_uid);
        } else {
          regularExtensions.push(item.uid);
        }
      });

      log(
        this.exportQueryConfig,
        `Identified ${marketplaceApps.length} marketplace apps and ${regularExtensions.length} regular extensions from ${extensionUIDs.length} total extensions`,
        'info',
      );

      return { extensions: regularExtensions, marketplaceApps };
    } catch (error) {
      log(this.exportQueryConfig, `Error fetching extensions and marketplace apps: ${error.message}`, 'error');
      return { extensions: extensionUIDs, marketplaceApps: [] };
    }
  }

  private traverseSchemaForDependencies(schema: any[], dependencies: any): void {
    for (const field of schema) {
      // Global fields
      if (field.data_type === 'global_field' && field.reference_to) {
        dependencies.globalFields.add(field.reference_to);
      }

      // Extensions
      if (field.extension_uid) {
        dependencies.extensions.add(field.extension_uid);
      }

      // Taxonomies - UPDATED LOGIC
      if (field.data_type === 'taxonomy' && field.taxonomies && Array.isArray(field.taxonomies)) {
        field.taxonomies.forEach((tax: any) => {
          if (tax.taxonomy_uid) {
            dependencies.taxonomies.add(tax.taxonomy_uid);
          }
        });
      }

      // Recursive traversal for nested structures
      if (field.data_type === 'group' && field.schema) {
        this.traverseSchemaForDependencies(field.schema, dependencies);
      }

      if (field.data_type === 'blocks' && field.blocks) {
        for (const blockKey in field.blocks) {
          if (field.blocks[blockKey].schema) {
            this.traverseSchemaForDependencies(field.blocks[blockKey].schema, dependencies);
          }
        }
      }
    }
  }
}
