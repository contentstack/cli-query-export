import { ContentstackClient } from '@contentstack/cli-utilities';
import { ExportQueryConfig, Modules } from '../types';
import { log } from '../utils/logger';
import config from '../config';

export interface DependencyMap {
  referencedModules: Map<Modules, string[]>;
  dependentModules: Map<Modules, string[]>;
}

export class DependencyResolver {
  private stackAPIClient: ReturnType<ContentstackClient['stack']>;
  private processedUIDs = new Set<string>(); // Loop protection
  private config = config;

  constructor(stackAPIClient: ReturnType<ContentstackClient['stack']>, configOverride?: any) {
    this.stackAPIClient = stackAPIClient;
    if (configOverride) {
      this.config = configOverride;
    }
  }

  async resolve(moduleName: Modules, data: any[], exportConfig: ExportQueryConfig): Promise<DependencyMap> {
    log(exportConfig, `Resolving dependencies for ${moduleName}...`, 'info');

    const dependencies: DependencyMap = {
      referencedModules: new Map(),
      dependentModules: new Map(),
    };

    this.processedUIDs.clear();
    const moduleConfig = this.config.modules.definitions[moduleName];

    if (!moduleConfig.dependencyAnalysis?.enabled) {
      return dependencies;
    }

    // Process each data item
    for (const item of data) {
      await this.processItem(item, moduleConfig, dependencies, exportConfig);
    }

    this.logDependencies(dependencies, exportConfig);
    return dependencies;
  }

  private async processItem(
    item: any,
    moduleConfig: any,
    dependencies: DependencyMap,
    exportConfig: ExportQueryConfig,
  ): Promise<void> {
    if (this.processedUIDs.has(item.uid)) {
      return; // Loop protection
    }

    this.processedUIDs.add(item.uid);

    const { fields, extractors } = moduleConfig.dependencyAnalysis;

    // Process specified fields or all fields if '*'
    const fieldsToAnalyze = fields.includes('*') ? [item] : fields.map((field: string) => item[field]).filter(Boolean);

    for (const fieldData of fieldsToAnalyze) {
      await this.analyzeFieldData(fieldData, extractors, dependencies, exportConfig);
    }
  }

  private async analyzeFieldData(
    data: any,
    extractors: string[],
    dependencies: DependencyMap,
    exportConfig: ExportQueryConfig,
  ): Promise<void> {
    if (!data) return;

    // If data is an array (like schema), process each item
    if (Array.isArray(data)) {
      for (const item of data) {
        await this.analyzeFieldData(item, extractors, dependencies, exportConfig);
      }
      return;
    }

    // Process with each configured extractor
    for (const extractorName of extractors) {
      const extractor = this.config.dependencyExtractors[extractorName];
      if (!extractor) continue;

      try {
        const extractedUIDs = extractor.extract(data);
        if (extractedUIDs.length > 0) {
          this.addDependencies(extractor.targetModule, extractedUIDs, dependencies);
        }
      } catch (error) {
        log(exportConfig, `Warning: Failed to extract dependencies with ${extractorName}: ${error.message}`, 'warn');
      }
    }

    // Recursively process nested objects
    if (typeof data === 'object' && data !== null) {
      for (const value of Object.values(data)) {
        if (typeof value === 'object') {
          await this.analyzeFieldData(value, extractors, dependencies, exportConfig);
        }
      }
    }
  }

  private addDependencies(targetModule: Modules, uids: string[], dependencies: DependencyMap): void {
    const moduleConfig = this.config.modules.definitions[targetModule];

    if (moduleConfig.queryable) {
      // If the target module is queryable, add to referenced modules
      if (!dependencies.referencedModules.has(targetModule)) {
        dependencies.referencedModules.set(targetModule, []);
      }
      const existing = dependencies.referencedModules.get(targetModule)!;
      const newUIDs = uids.filter((uid) => !existing.includes(uid));
      existing.push(...newUIDs);
    } else {
      // If not queryable, add to dependent modules
      if (!dependencies.dependentModules.has(targetModule)) {
        dependencies.dependentModules.set(targetModule, []);
      }
      const existing = dependencies.dependentModules.get(targetModule)!;
      const newUIDs = uids.filter((uid) => !existing.includes(uid));
      existing.push(...newUIDs);
    }
  }

  private logDependencies(dependencies: DependencyMap, exportConfig: ExportQueryConfig): void {
    const referencedCount = Array.from(dependencies.referencedModules.values()).reduce(
      (sum, uids) => sum + uids.length,
      0,
    );
    const dependentCount = Array.from(dependencies.dependentModules.values()).reduce(
      (sum, uids) => sum + uids.length,
      0,
    );

    log(exportConfig, `Found dependencies: ${referencedCount} referenced, ${dependentCount} dependent`, 'info');

    for (const [module, uids] of dependencies.referencedModules.entries()) {
      if (uids.length > 0) {
        log(exportConfig, `  Referenced ${module}: ${uids.length} items`, 'info');
      }
    }

    for (const [module, uids] of dependencies.dependentModules.entries()) {
      if (uids.length > 0) {
        log(exportConfig, `  Dependent ${module}: ${uids.length} items`, 'info');
      }
    }
  }
}
