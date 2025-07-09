import { ContentstackClient, formatError } from '@contentstack/cli-utilities';
import { ExportQueryConfig, Modules } from '../types';
import { log } from '../utils/logger';
import { writeFile } from '../utils/file-utils';
import config from '../config';
import * as path from 'path';

export class ModuleExecutor {
  private stackAPIClient: ReturnType<ContentstackClient['stack']>;
  private exportConfig: ExportQueryConfig;
  private exportedModules: string[] = [];

  constructor(stackAPIClient: ReturnType<ContentstackClient['stack']>, exportConfig: ExportQueryConfig) {
    this.stackAPIClient = stackAPIClient;
    this.exportConfig = exportConfig;
  }

  async exportModule(moduleName: Modules): Promise<void> {
    try {
      log(this.exportConfig, `Exporting module: ${moduleName}`, 'info');

      const moduleConfig = config.modules.definitions[moduleName];
      let data: any;

      switch (moduleName) {
        case 'stack':
          data = await this.stackAPIClient.fetch();
          break;
        case 'locales':
          data = (await this.stackAPIClient.locale().query().find()).items;
          break;
        case 'environments':
          data = (await this.stackAPIClient.environment().query().find()).items;
          break;
        default:
          throw new Error(`Unknown general module: ${moduleName}`);
      }

      await this.writeModuleData(moduleName, data);
      this.exportedModules.push(moduleName);
      log(this.exportConfig, `Successfully exported: ${moduleName}`, 'success');
    } catch (error) {
      log(this.exportConfig, `Failed to export ${moduleName}: ${formatError(error)}`, 'error');
      throw error;
    }
  }

  async exportModuleWithQuery(moduleName: Modules, query: any): Promise<any[]> {
    const moduleConfig = config.modules.definitions[moduleName];

    if (!moduleConfig.queryable) {
      throw new Error(`Module ${moduleName} is not queryable`);
    }

    const data: any[] = [];
    let skip = 0;
    const limit = moduleConfig.queryConfig?.defaultLimit || 100;

    try {
      log(this.exportConfig, `Exporting ${moduleName} with query: ${JSON.stringify(query)}`, 'info');

      while (true) {
        let response: any;
        const queryParams: any = {
          query,
          skip,
          limit,
        };

        // Add module-specific query parameters
        if (moduleConfig.queryConfig?.includeGlobalFieldSchema) {
          queryParams.include_global_field_schema = true;
        }
        if (moduleConfig.queryConfig?.includePublishDetails) {
          queryParams.include_publish_details = true;
        }
        if (moduleConfig.queryConfig?.includeDimension) {
          queryParams.include_dimension = true;
        }

        // Execute query based on module type
        switch (moduleName) {
          case 'content-types':
            response = await this.stackAPIClient.contentType().query(queryParams).find();
            break;
          case 'entries':
            response = await this.stackAPIClient.entry().query(queryParams).find();
            break;
          case 'assets':
            response = await this.stackAPIClient.asset().query(queryParams).find();
            break;
          case 'global-fields':
            response = await this.stackAPIClient.globalField().query(queryParams).find();
            break;
          case 'extensions':
            response = await this.stackAPIClient.extension().query(queryParams).find();
            break;
          case 'taxonomies':
            response = await this.stackAPIClient.taxonomy().query(queryParams).find();
            break;
          default:
            throw new Error(`Query not supported for module: ${moduleName}`);
        }

        if (response.items && response.items.length > 0) {
          data.push(...response.items);
          skip += limit;

          if (skip >= response.count) {
            break;
          }
        } else {
          break;
        }
      }

      await this.writeModuleData(moduleName, data);
      this.exportedModules.push(moduleName);

      log(this.exportConfig, `Successfully exported ${data.length} ${moduleName}`, 'success');
      return data;
    } catch (error) {
      log(this.exportConfig, `Failed to export ${moduleName}: ${formatError(error)}`, 'error');
      throw error;
    }
  }

  async exportModuleWithUIDs(moduleName: Modules, uids: string[]): Promise<any[]> {
    if (uids.length === 0) return [];

    log(this.exportConfig, `Exporting ${uids.length} ${moduleName} by UIDs...`, 'info');

    try {
      const data = [];

      // Fetch items by UID
      for (const uid of uids) {
        let item: any;

        switch (moduleName) {
          case 'content-types':
            item = await this.stackAPIClient.contentType(uid).fetch();
            break;
          case 'global-fields':
            item = await this.stackAPIClient.globalField(uid).fetch();
            break;
          case 'extensions':
            item = await this.stackAPIClient.extension(uid).fetch();
            break;
          case 'taxonomies':
            item = await this.stackAPIClient.taxonomy(uid).fetch();
            break;
          case 'assets':
            item = await this.stackAPIClient.asset(uid).fetch();
            break;
          case 'entries':
            item = await this.stackAPIClient.entry(uid).fetch();
            break;
          default:
            throw new Error(`UID-based export not supported for module: ${moduleName}`);
        }

        if (item) {
          data.push(item);
        }
      }

      await this.writeModuleData(moduleName, data);

      if (!this.exportedModules.includes(moduleName)) {
        this.exportedModules.push(moduleName);
      }

      log(this.exportConfig, `Successfully exported ${data.length} ${moduleName} by UIDs`, 'success');
      return data;
    } catch (error) {
      log(this.exportConfig, `Failed to export ${moduleName} by UIDs: ${formatError(error)}`, 'error');
      throw error;
    }
  }

  async exportEntriesForContentTypes(contentTypeUIDs: string[]): Promise<any[]> {
    const allEntries: any[] = [];

    try {
      for (const ctUID of contentTypeUIDs) {
        const entries = await this.fetchEntriesForContentType(ctUID);
        allEntries.push(...entries);
      }

      await this.writeModuleData('entries', allEntries);

      if (!this.exportedModules.includes('entries')) {
        this.exportedModules.push('entries');
      }

      log(this.exportConfig, `Successfully exported ${allEntries.length} entries`, 'success');
      return allEntries;
    } catch (error) {
      log(this.exportConfig, `Failed to export entries: ${formatError(error)}`, 'error');
      throw error;
    }
  }

  private async fetchEntriesForContentType(contentTypeUID: string): Promise<any[]> {
    const entries: any[] = [];
    let skip = 0;
    const limit = config.modules.definitions.entries.queryConfig?.defaultLimit || 100;

    while (true) {
      const response = await this.stackAPIClient
        .contentType(contentTypeUID)
        .entry()
        .query({
          skip,
          limit,
          include_publish_details: true,
        })
        .find();

      if (response.items && response.items.length > 0) {
        entries.push(...response.items);
        skip += limit;

        if (skip >= response.count) {
          break;
        }
      } else {
        break;
      }
    }

    return entries;
  }

  private async writeModuleData(moduleName: Modules, data: any): Promise<void> {
    const moduleConfig = config.modules.definitions[moduleName];
    const moduleDir = path.join(this.exportConfig.exportDir, moduleConfig.dirName);

    // Write main module file
    await writeFile(path.join(moduleDir, moduleConfig.fileName), data);

    // Write individual files for certain modules
    if (Array.isArray(data) && ['content-types', 'global-fields', 'extensions', 'taxonomies'].includes(moduleName)) {
      for (const item of data) {
        const filename = `${item.uid}.json`;
        await writeFile(path.join(moduleDir, filename), item);
      }
    }
  }

  getExportedModules(): string[] {
    return [...this.exportedModules];
  }
}
