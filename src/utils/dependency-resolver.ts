import { ContentstackClient } from '@contentstack/cli-utilities';
import { ExportConfig, Modules } from '../types';
import { log } from './logger';
import { QueryResolver } from './query-resolver';

export interface ModuleDependencyMap {
  [moduleName: string]: {
    dependencies: Modules[];
    dependents: string[];
  };
}

// Predefined module dependencies in the correct order
const MODULE_DEPENDENCIES: Record<Modules, Modules[]> = {
  stack: [],
  locales: ['stack'],
  environments: ['stack', 'locales'],
  'content-types': ['stack', 'locales', 'environments'],
  extensions: ['stack', 'locales', 'environments', 'content-types'],
  'global-fields': ['stack', 'locales', 'environments', 'content-types', 'extensions'],
  entries: ['stack', 'locales', 'environments', 'content-types', 'extensions', 'global-fields'],
  assets: ['stack', 'locales', 'environments', 'content-types', 'extensions', 'global-fields', 'entries'],
  webhooks: ['stack', 'locales', 'environments', 'content-types', 'extensions', 'global-fields', 'entries', 'assets'],
  workflows: [
    'stack',
    'locales',
    'environments',
    'content-types',
    'extensions',
    'global-fields',
    'entries',
    'assets',
    'webhooks',
  ],
  'custom-roles': [
    'stack',
    'locales',
    'environments',
    'content-types',
    'extensions',
    'global-fields',
    'entries',
    'assets',
    'webhooks',
    'workflows',
  ],
  labels: [
    'stack',
    'locales',
    'environments',
    'content-types',
    'extensions',
    'global-fields',
    'entries',
    'assets',
    'webhooks',
    'workflows',
    'custom-roles',
  ],
  taxonomies: [
    'stack',
    'locales',
    'environments',
    'content-types',
    'extensions',
    'global-fields',
    'entries',
    'assets',
    'webhooks',
    'workflows',
    'custom-roles',
    'labels',
  ],
  'marketplace-apps': [
    'stack',
    'locales',
    'environments',
    'content-types',
    'extensions',
    'global-fields',
    'entries',
    'assets',
    'webhooks',
    'workflows',
    'custom-roles',
    'labels',
    'taxonomies',
  ],
  personalize: [
    'stack',
    'locales',
    'environments',
    'content-types',
    'extensions',
    'global-fields',
    'entries',
    'assets',
    'webhooks',
    'workflows',
    'custom-roles',
    'labels',
    'taxonomies',
    'marketplace-apps',
  ],
};

// Export order based on dependencies
const EXPORT_ORDER: Modules[] = [
  'stack',
  'locales',
  'environments',
  'content-types',
  'extensions',
  'global-fields',
  'entries',
  'assets',
  'webhooks',
  'workflows',
  'custom-roles',
  'labels',
  'taxonomies',
  'marketplace-apps',
  'personalize',
];

// Modules that are analyzed for content dependencies
const DEPENDENCY_ANALYZABLE_MODULES: Modules[] = ['content-types', 'global-fields'];

export interface DependencyResolverConfig {
  originalModules: Modules[];
  queryResolver?: QueryResolver;
  includeReference?: boolean;
  skipReference?: boolean;
}

export class DependencyResolver {
  private stackAPIClient: ReturnType<ContentstackClient['stack']>;
  private exportConfig: ExportConfig;
  private queryResolver: QueryResolver;
  private resolvedDependencies: ModuleDependencyMap = {};
  private config: DependencyResolverConfig;

  constructor(
    stackAPIClient: ReturnType<ContentstackClient['stack']>,
    exportConfig: ExportConfig,
    queryResolver: QueryResolver,
    config: DependencyResolverConfig,
  ) {
    this.stackAPIClient = stackAPIClient;
    this.exportConfig = exportConfig;
    this.queryResolver = queryResolver;
    this.config = config;
  }

  /**
   * Resolve modules based on query and reference flags
   */
  resolveModules(): Modules[] {
    if (!this.config.queryResolver) {
      // No query, return original modules in dependency order
      return this.orderModules(this.config.originalModules);
    }

    const modulesWithQueries = this.config.queryResolver.getModulesWithQueries();

    if (this.config.skipReference) {
      // Only export modules with direct queries
      return this.orderModules(modulesWithQueries);
    }

    if (this.config.includeReference) {
      // Include all dependencies for queried modules
      const dependentModules = this.getDependencies(modulesWithQueries);
      const allModules = [...new Set([...dependentModules, ...modulesWithQueries])];
      return this.orderModules(allModules);
    }

    // Default behavior: include essential dependencies
    const essentialDependencies = this.getEssentialDependencies(modulesWithQueries);
    const allModules = [...new Set([...essentialDependencies, ...modulesWithQueries])];
    return this.orderModules(allModules);
  }

  /**
   * Get all dependencies for the given modules
   */
  private getDependencies(modules: Modules[]): Modules[] {
    const dependencies: Set<Modules> = new Set();

    for (const module of modules) {
      const moduleDeps = MODULE_DEPENDENCIES[module] || [];
      for (const dep of moduleDeps) {
        dependencies.add(dep);
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Get essential dependencies (stack, locales, environments, content-types)
   */
  private getEssentialDependencies(modules: Modules[]): Modules[] {
    const essentialModules: Modules[] = ['stack', 'locales', 'environments'];

    // Add content-types if not already in the queried modules
    if (!modules.includes('content-types')) {
      essentialModules.push('content-types');
    }

    return essentialModules;
  }

  /**
   * Order modules based on dependency order
   */
  private orderModules(modules: Modules[]): Modules[] {
    return EXPORT_ORDER.filter((module) => modules.includes(module));
  }

  /**
   * Check if a module should be exported
   */
  shouldExportModule(module: Modules): boolean {
    const resolvedModules = this.resolveModules();
    return resolvedModules.includes(module);
  }

  /**
   * Get modules that should be exported
   */
  getModulesToExport(): Modules[] {
    return this.resolveModules();
  }

  /**
   * Check if module has dependencies that need to be exported first
   */
  getModuleDependencies(module: Modules): Modules[] {
    return MODULE_DEPENDENCIES[module] || [];
  }

  /**
   * Validate if all dependencies are satisfied
   */
  validateDependencies(modules: Modules[]): { valid: boolean; missing: Modules[] } {
    const missing: Modules[] = [];

    for (const module of modules) {
      const dependencies = this.getModuleDependencies(module);
      for (const dep of dependencies) {
        if (!modules.includes(dep)) {
          missing.push(dep);
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing: [...new Set(missing)],
    };
  }

  /**
   * Resolve dependencies and reorder modules based on query
   */
  async resolveDependencies(): Promise<{
    orderedModules: Modules[];
    dependencyMap: ModuleDependencyMap;
  }> {
    log(this.exportConfig, 'Starting dependency resolution...', 'info');

    // Get modules that have user queries
    const queriedModules = this.queryResolver.getModulesWithQueries();
    log(this.exportConfig, `Modules with user queries: ${queriedModules.join(', ')}`, 'info');

    // Start with queried modules and their dependencies
    const requiredModules = new Set<Modules>();

    // Add all dependencies for queried modules
    for (const module of queriedModules) {
      this.addModuleWithDependencies(module, requiredModules);
    }

    // Analyze content dependencies for applicable modules
    for (const module of queriedModules) {
      if (DEPENDENCY_ANALYZABLE_MODULES.includes(module)) {
        const contentDependencies = await this.analyzeContentDependencies(module);
        for (const depModule of contentDependencies) {
          this.addModuleWithDependencies(depModule, requiredModules);
        }
      }
    }

    // Order modules based on dependencies
    const orderedModules = this.orderModulesByDependencies(Array.from(requiredModules));

    log(this.exportConfig, `Final module order: ${orderedModules.join(' -> ')}`, 'success');

    return {
      orderedModules,
      dependencyMap: this.resolvedDependencies,
    };
  }

  /**
   * Add a module and all its dependencies to the required set
   */
  private addModuleWithDependencies(module: Modules, requiredModules: Set<Modules>): void {
    const dependencies = MODULE_DEPENDENCIES[module] || [];

    // Add all dependencies first
    for (const dep of dependencies) {
      requiredModules.add(dep);
    }

    // Add the module itself
    requiredModules.add(module);

    // Store in resolved dependencies
    this.resolvedDependencies[module] = {
      dependencies,
      dependents: [],
    };
  }

  /**
   * Analyze content dependencies by examining schemas
   */
  private async analyzeContentDependencies(moduleName: Modules): Promise<Modules[]> {
    const dependencies = new Set<Modules>();

    try {
      switch (moduleName) {
        case 'content-types':
          const contentDeps = await this.analyzeContentTypeDependencies();
          contentDeps.forEach((dep) => dependencies.add(dep));
          break;
        case 'global-fields':
          const globalFieldDeps = await this.analyzeGlobalFieldDependencies();
          globalFieldDeps.forEach((dep) => dependencies.add(dep));
          break;
        default:
          log(this.exportConfig, `No content dependency analysis available for module: ${moduleName}`, 'info');
      }
    } catch (error) {
      log(this.exportConfig, `Warning: Failed to analyze dependencies for ${moduleName}: ${error.message}`, 'warn');
    }

    return Array.from(dependencies);
  }

  /**
   * Analyze content type dependencies
   */
  private async analyzeContentTypeDependencies(): Promise<Modules[]> {
    const dependencies = new Set<Modules>();
    const globalFieldUIDs = new Set<string>();
    const extensionUIDs = new Set<string>();
    const taxonomyUIDs = new Set<string>();
    const referencedContentTypes = new Set<string>();

    // Get content types that match the query
    const moduleQuery = this.queryResolver.getModuleQuery('content-types');
    if (!moduleQuery) return [];

    const cmaQuery = this.queryResolver.convertToCMAFormat('content-types', moduleQuery);

    try {
      let skip = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await this.stackAPIClient
          .contentType()
          .query({
            ...cmaQuery,
            skip,
            limit,
          })
          .find();

        if (response.items && response.items.length > 0) {
          for (const contentType of response.items) {
            this.analyzeContentTypeSchema(
              contentType,
              globalFieldUIDs,
              extensionUIDs,
              taxonomyUIDs,
              referencedContentTypes,
            );
          }

          skip += limit;
          hasMore = skip < response.count;
        } else {
          hasMore = false;
        }
      }

      // Store dependent UIDs for system query generation
      if (globalFieldUIDs.size > 0) {
        dependencies.add('global-fields');
        this.resolvedDependencies['global-fields'] = {
          dependencies: MODULE_DEPENDENCIES['global-fields'],
          dependents: Array.from(globalFieldUIDs),
        };
      }

      if (extensionUIDs.size > 0) {
        dependencies.add('extensions');
        this.resolvedDependencies['extensions'] = {
          dependencies: MODULE_DEPENDENCIES['extensions'],
          dependents: Array.from(extensionUIDs),
        };
      }

      if (taxonomyUIDs.size > 0) {
        dependencies.add('taxonomies');
        this.resolvedDependencies['taxonomies'] = {
          dependencies: MODULE_DEPENDENCIES['taxonomies'],
          dependents: Array.from(taxonomyUIDs),
        };
      }

      if (referencedContentTypes.size > 0) {
        dependencies.add('entries');
        this.resolvedDependencies['entries'] = {
          dependencies: MODULE_DEPENDENCIES['entries'],
          dependents: Array.from(referencedContentTypes),
        };

        // Also need assets for entries
        dependencies.add('assets');
      }
    } catch (error) {
      log(
        this.exportConfig,
        `Warning: Failed to fetch content types for dependency analysis: ${error.message}`,
        'warn',
      );
    }

    return Array.from(dependencies);
  }

  /**
   * Analyze individual content type schema for dependencies
   */
  private analyzeContentTypeSchema(
    contentType: any,
    globalFieldUIDs: Set<string>,
    extensionUIDs: Set<string>,
    taxonomyUIDs: Set<string>,
    referencedContentTypes: Set<string>,
  ): void {
    if (!contentType.schema) return;

    for (const field of contentType.schema) {
      this.analyzeField(field, globalFieldUIDs, extensionUIDs, taxonomyUIDs, referencedContentTypes);
    }
  }

  /**
   * Analyze individual field for dependencies
   */
  private analyzeField(
    field: any,
    globalFieldUIDs: Set<string>,
    extensionUIDs: Set<string>,
    taxonomyUIDs: Set<string>,
    referencedContentTypes: Set<string>,
  ): void {
    switch (field.data_type) {
      case 'global_field':
        if (field.reference_to) {
          globalFieldUIDs.add(field.reference_to);
        }
        break;

      case 'reference':
        if (field.reference_to && Array.isArray(field.reference_to)) {
          field.reference_to.forEach((ref: string) => {
            referencedContentTypes.add(ref);
          });
        }
        break;

      case 'json':
        if (field.field_metadata?.extension) {
          extensionUIDs.add(field.field_metadata.extension);
        }
        break;

      case 'taxonomy':
        if (field.taxonomies && Array.isArray(field.taxonomies)) {
          field.taxonomies.forEach((taxonomy: any) => {
            if (taxonomy.taxonomy_uid) {
              taxonomyUIDs.add(taxonomy.taxonomy_uid);
            }
          });
        }
        break;

      case 'group':
      case 'blocks':
        // Recursively analyze nested fields
        if (field.schema && Array.isArray(field.schema)) {
          for (const nestedField of field.schema) {
            this.analyzeField(nestedField, globalFieldUIDs, extensionUIDs, taxonomyUIDs, referencedContentTypes);
          }
        }
        // For blocks, also check each block type
        if (field.blocks && Array.isArray(field.blocks)) {
          for (const block of field.blocks) {
            if (block.schema && Array.isArray(block.schema)) {
              for (const blockField of block.schema) {
                this.analyzeField(blockField, globalFieldUIDs, extensionUIDs, taxonomyUIDs, referencedContentTypes);
              }
            }
          }
        }
        break;

      default:
        // Check if field has any custom extensions
        if (field.field_metadata?.extension) {
          extensionUIDs.add(field.field_metadata.extension);
        }
        break;
    }
  }

  /**
   * Analyze global field dependencies (similar to content types)
   */
  private async analyzeGlobalFieldDependencies(): Promise<Modules[]> {
    // Implementation similar to content types but for global fields
    // This would analyze global field schemas for their dependencies
    return [];
  }

  /**
   * Order modules by their dependencies using topological sort
   */
  private orderModulesByDependencies(modules: Modules[]): Modules[] {
    const visited = new Set<Modules>();
    const visiting = new Set<Modules>();
    const result: Modules[] = [];

    const visit = (module: Modules) => {
      if (visiting.has(module)) {
        throw new Error(`Circular dependency detected involving ${module}`);
      }
      if (visited.has(module)) {
        return;
      }

      visiting.add(module);
      const dependencies = MODULE_DEPENDENCIES[module] || [];

      for (const dep of dependencies) {
        if (modules.includes(dep)) {
          visit(dep);
        }
      }

      visiting.delete(module);
      visited.add(module);
      result.push(module);
    };

    for (const module of modules) {
      visit(module);
    }

    return result;
  }

  /**
   * Get dependent items for a module (for system query generation)
   */
  getDependentItems(moduleName: Modules): string[] {
    return this.resolvedDependencies[moduleName]?.dependents || [];
  }
}

/**
 * Create dependency resolver from export configuration
 */
export function createDependencyResolver(
  stackAPIClient: ReturnType<ContentstackClient['stack']>,
  exportConfig: ExportConfig,
  queryResolver: QueryResolver,
  config: DependencyResolverConfig,
): DependencyResolver {
  return new DependencyResolver(stackAPIClient, exportConfig, queryResolver, config);
}
