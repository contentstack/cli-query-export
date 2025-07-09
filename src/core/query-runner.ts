import { ContentstackClient } from '@contentstack/cli-utilities';
import { ExportQueryConfig, Modules } from '../types';
import { QueryParser } from '../utils/query-parser';
import { DependencyResolver } from './dependency-resolver';
import { ModuleExecutor } from './module-executor';
import { JsonWriter } from '../utils/json-writer';
import { AssetUtils } from '../utils/asset-utils';
import { log } from '../utils/logger';
import config from '../config';

export class QueryRunner {
  private managementAPIClient: ContentstackClient;
  private stackAPIClient: ReturnType<ContentstackClient['stack']>;
  private exportConfig: ExportQueryConfig;
  private queryParser: QueryParser;
  private dependencyResolver: DependencyResolver;
  private moduleExecutor: ModuleExecutor;
  private jsonWriter: JsonWriter;
  private assetUtils: AssetUtils;

  constructor(managementAPIClient: ContentstackClient, exportConfig: ExportQueryConfig) {
    this.managementAPIClient = managementAPIClient;
    this.stackAPIClient = managementAPIClient.stack({
      api_key: exportConfig.stackApiKey,
      management_token: exportConfig.managementToken,
    });
    this.exportConfig = exportConfig;

    // Initialize components
    this.queryParser = new QueryParser(config);
    this.dependencyResolver = new DependencyResolver(this.stackAPIClient, config);
    this.moduleExecutor = new ModuleExecutor(this.stackAPIClient, exportConfig);
    this.jsonWriter = new JsonWriter(exportConfig);
    this.assetUtils = new AssetUtils(config);
  }

  async execute(): Promise<void> {
    log(this.exportConfig, 'Starting query-based export...', 'info');

    // Step 1: Parse and validate query
    const parsedQuery = await this.queryParser.parse(this.exportConfig.queryInput!);
    log(this.exportConfig, 'Query parsed and validated successfully', 'success');

    // Step 2: Always export general modules
    await this.exportGeneralModules();

    // Step 3: Process each queryable module in the query
    const allExportedData: { [module: string]: any[] } = {};

    for (const [moduleName, moduleQuery] of Object.entries(parsedQuery.modules)) {
      const module = moduleName as Modules;

      if (!config.modules.capabilities.queryable.includes(module)) {
        throw new Error(`Module "${module}" is not queryable`);
      }

      // Export the queried module
      const exportedData = await this.exportQueriedModule(module, moduleQuery);
      allExportedData[module] = exportedData;

      if (exportedData.length === 0) {
        log(this.exportConfig, `No ${module} found matching query`, 'warn');
        continue;
      }

      log(this.exportConfig, `Found ${exportedData.length} ${module} matching query`, 'info');

      // Step 4: Resolve dependencies for this module
      if (!this.exportConfig.skipReferences || !this.exportConfig.skipDependencies) {
        await this.processDependencies(module, exportedData);
      }
    }

    // Step 5: Write query metadata
    await this.writeQueryMetadata(parsedQuery, allExportedData);

    log(this.exportConfig, 'Query-based export completed successfully!', 'success');
  }

  private async exportGeneralModules(): Promise<void> {
    log(this.exportConfig, 'Exporting general modules...', 'info');

    for (const module of config.modules.capabilities.general) {
      await this.moduleExecutor.exportModule(module);
    }
  }

  private async exportQueriedModule(moduleName: Modules, moduleQuery: any): Promise<any[]> {
    log(this.exportConfig, `Exporting ${moduleName} with query...`, 'info');

    return await this.moduleExecutor.exportModuleWithQuery(moduleName, moduleQuery);
  }

  private async processDependencies(moduleName: Modules, exportedData: any[]): Promise<void> {
    const moduleConfig = config.modules.definitions[moduleName];

    if (!moduleConfig.dependencyAnalysis?.enabled) {
      log(this.exportConfig, `No dependency analysis configured for ${moduleName}`, 'info');
      return;
    }

    // Step 1: Resolve dependencies
    const dependencies = await this.dependencyResolver.resolve(moduleName, exportedData, this.exportConfig);

    // Step 2: Export referenced modules (unless skipped)
    if (!this.exportConfig.skipReferences && dependencies.referencedModules.size > 0) {
      await this.exportReferencedModules(dependencies.referencedModules);
    }

    // Step 3: Export dependent modules (unless skipped)
    if (!this.exportConfig.skipDependencies && dependencies.dependentModules.size > 0) {
      await this.exportDependentModules(dependencies.dependentModules);
    }

    // Step 4: Export content modules (entries/assets)
    if (moduleName === 'content-types' || moduleName === 'entries') {
      await this.exportContentModules(moduleName, exportedData, dependencies);
    }
  }

  private async exportReferencedModules(referencedModules: Map<Modules, string[]>): Promise<void> {
    log(this.exportConfig, 'Exporting referenced modules...', 'info');

    for (const [module, uids] of referencedModules.entries()) {
      if (uids.length > 0) {
        const referenceQuery = { uid: { $in: uids } };
        await this.moduleExecutor.exportModuleWithQuery(module, referenceQuery);
      }
    }
  }

  private async exportDependentModules(dependentModules: Map<Modules, string[]>): Promise<void> {
    log(this.exportConfig, 'Exporting dependent modules...', 'info');

    for (const [module, uids] of dependentModules.entries()) {
      if (uids.length > 0) {
        await this.moduleExecutor.exportModuleWithUIDs(module, uids);
      }
    }
  }

  private async exportContentModules(sourceModule: Modules, sourceData: any[], dependencies: any): Promise<void> {
    // Export entries for content types
    if (sourceModule === 'content-types') {
      const contentTypeUIDs = sourceData.map((ct) => ct.uid);
      const exportedEntries = await this.moduleExecutor.exportEntriesForContentTypes(contentTypeUIDs);

      // Extract and export referenced assets
      const referencedAssets = this.assetUtils.extractAssetUIDs(exportedEntries);
      if (referencedAssets.length > 0) {
        await this.moduleExecutor.exportModuleWithUIDs('assets', referencedAssets);
      }
    }

    // Extract assets from entries
    if (sourceModule === 'entries') {
      const referencedAssets = this.assetUtils.extractAssetUIDs(sourceData);
      if (referencedAssets.length > 0) {
        await this.moduleExecutor.exportModuleWithUIDs('assets', referencedAssets);
      }
    }
  }

  private async writeQueryMetadata(query: any, exportedData: { [module: string]: any[] }): Promise<void> {
    const metadata = {
      query: query,
      flags: {
        skipReferences: this.exportConfig.skipReferences || false,
        skipDependencies: this.exportConfig.skipDependencies || false,
      },
      timestamp: new Date().toISOString(),
      cliVersion: process.env.npm_package_version || 'unknown',
      exportedModules: this.moduleExecutor.getExportedModules(),
      queryResults: Object.entries(exportedData).map(([module, data]) => ({
        module,
        count: data.length,
        items: data.map((item: any) => ({
          uid: item.uid,
          title: item.title || item.name || item.filename,
        })),
      })),
      summary: {
        totalModules: this.moduleExecutor.getExportedModules().length,
        totalQueriedItems: Object.values(exportedData).reduce((sum, data) => sum + data.length, 0),
      },
    };

    await this.jsonWriter.writeQueryMetadata(metadata);
  }
}
