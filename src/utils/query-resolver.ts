import * as fs from 'fs';
import * as path from 'path';
import { cliux, CLIError } from '@contentstack/cli-utilities';
import { ExportConfig, Modules } from '../types';

export interface ModuleQuery {
  [field: string]: any;
}

export interface StructuredQuery {
  modules: {
    [moduleName: string]: ModuleQuery;
  };
}

export interface ResolvedQuery {
  originalQuery: StructuredQuery;
  isQueryBasedExport: boolean;
  modulesWithQueries: Modules[];
}

// Valid fields for each module type
const MODULE_VALID_FIELDS: Record<Modules, string[]> = {
  'content-types': [
    'uid',
    'title',
    'description',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by',
    'tags',
    'singleton',
  ],
  'global-fields': ['uid', 'title', 'description', 'created_at', 'updated_at', 'created_by', 'updated_by', 'tags'],
  entries: [
    'uid',
    'title',
    'locale',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by',
    'tags',
    'content_type_uid',
  ],
  assets: [
    'uid',
    'title',
    'filename',
    'content_type',
    'file_size',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by',
    'tags',
  ],
  extensions: ['uid', 'title', 'type', 'created_at', 'updated_at', 'created_by', 'updated_by', 'tags'],
  webhooks: ['uid', 'name', 'channels', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  workflows: ['uid', 'name', 'description', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  environments: ['uid', 'name', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  locales: ['code', 'name', 'uid', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  labels: ['uid', 'name', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  'custom-roles': ['uid', 'name', 'description', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  taxonomies: ['uid', 'name', 'description', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  'marketplace-apps': ['uid', 'name', 'description', 'created_at', 'updated_at'],
  stack: ['uid', 'name', 'description', 'created_at', 'updated_at'],
  personalize: ['uid', 'name', 'created_at', 'updated_at'],
};

// Valid query operators
const VALID_OPERATORS = [
  '$eq',
  '$ne',
  '$lt',
  '$lte',
  '$gt',
  '$gte',
  '$in',
  '$nin',
  '$exists',
  '$regex',
  '$all',
  '$and',
  '$or',
  '$not',
  '$nor',
];

// User-accessible modules (modules that users can query directly)
const USER_QUERYABLE_MODULES: Modules[] = ['content-types'];

export class QueryResolver {
  private exportConfig: ExportConfig;
  private resolvedQuery?: ResolvedQuery;

  constructor(exportConfig: ExportConfig) {
    this.exportConfig = exportConfig;
  }

  /**
   * Parse and validate query from string or file path
   */
  async parseQuery(queryInput: string): Promise<StructuredQuery> {
    if (!queryInput) {
      throw new CLIError('Query cannot be empty');
    }

    let parsedQuery: StructuredQuery;

    // Check if it's a file path
    if (queryInput.endsWith('.json') && fs.existsSync(queryInput)) {
      try {
        const fileContent = fs.readFileSync(queryInput, 'utf-8');
        parsedQuery = JSON.parse(fileContent);
      } catch (error: any) {
        throw new CLIError(`Failed to parse query file: ${error.message}`);
      }
    } else {
      // Try to parse as JSON string
      try {
        parsedQuery = JSON.parse(queryInput);
      } catch (error: any) {
        throw new CLIError(`Invalid JSON query format: ${error.message}`);
      }
    }

    return parsedQuery;
  }

  /**
   * Validate the structured query format
   */
  validateQuery(query: StructuredQuery): boolean {
    if (!query || typeof query !== 'object') {
      throw new CLIError('Query must be a valid JSON object');
    }

    if (!query.modules || typeof query.modules !== 'object') {
      throw new CLIError('Query must contain a "modules" object');
    }

    if (Object.keys(query.modules).length === 0) {
      throw new CLIError('Query must contain at least one module');
    }

    // Validate each module query
    for (const [moduleName, moduleQuery] of Object.entries(query.modules)) {
      this.validateModuleQuery(moduleName as Modules, moduleQuery);
    }

    return true;
  }

  /**
   * Validate query for a specific module
   */
  private validateModuleQuery(moduleName: Modules, moduleQuery: ModuleQuery): boolean {
    // Check if module is user-queryable
    if (!USER_QUERYABLE_MODULES.includes(moduleName)) {
      throw new CLIError(
        `Module "${moduleName}" is not queryable by users. Supported modules: ${USER_QUERYABLE_MODULES.join(', ')}`,
      );
    }

    // Check if module is valid
    if (!MODULE_VALID_FIELDS[moduleName]) {
      throw new CLIError(`Unknown module: ${moduleName}`);
    }
    return true;
  }

  /**
   * Resolve query configuration
   */
  async resolveQuery(queryInput: string): Promise<ResolvedQuery> {
    const originalQuery = await this.parseQuery(queryInput);
    this.validateQuery(originalQuery);

    const modulesWithQueries = Object.keys(originalQuery.modules) as Modules[];

    this.resolvedQuery = {
      originalQuery,
      isQueryBasedExport: true,
      modulesWithQueries,
    };

    return this.resolvedQuery;
  }

  /**
   * Get query for a specific module
   */
  getModuleQuery(moduleName: Modules): ModuleQuery | null {
    if (!this.resolvedQuery) {
      return null;
    }

    return this.resolvedQuery.originalQuery.modules[moduleName] || null;
  }

  /**
   * Convert module query to Content Management API format
   */
  convertToCMAFormat(moduleName: Modules, moduleQuery: ModuleQuery): Record<string, any> {
    const cmaQuery: Record<string, any> = {
      include_count: true,
      asc: 'updated_at',
    };

    // Add module-specific CMA parameters
    switch (moduleName) {
      case 'content-types':
        cmaQuery.include_global_field_schema = true;
        break;
      case 'entries':
        cmaQuery.include_publish_details = true;
        break;
      case 'assets':
        cmaQuery.include_dimension = true;
        break;
      default:
        // Default parameters
        break;
    }

    // Add the query parameter if moduleQuery has conditions
    if (Object.keys(moduleQuery).length > 0) {
      cmaQuery.query = moduleQuery;
    }

    return cmaQuery;
  }

  /**
   * Check if a module has a query
   */
  hasModuleQuery(moduleName: Modules): boolean {
    return this.resolvedQuery?.modulesWithQueries.includes(moduleName) || false;
  }

  /**
   * Get all modules that have queries
   */
  getModulesWithQueries(): Modules[] {
    return this.resolvedQuery?.modulesWithQueries || [];
  }

  /**
   * Generate system queries for dependent modules (internal use)
   */
  generateSystemQuery(moduleName: Modules, dependentItems: string[]): ModuleQuery {
    if (dependentItems.length === 0) {
      return {};
    }

    // Generate UID-based query for dependent items
    return {
      uid: {
        $in: dependentItems,
      },
    };
  }

  /**
   * Get resolved query data
   */
  getResolvedQuery(): ResolvedQuery | undefined {
    return this.resolvedQuery;
  }
}

/**
 * Setup query resolver from export configuration
 */
export async function setupQueryResolver(exportConfig: ExportConfig): Promise<QueryResolver | null> {
  if (!exportConfig.queryResolver) {
    return null;
  }
  return exportConfig.queryResolver;
}

/**
 * Generate query metadata for export
 */
export function generateQueryMetadata(
  queryResolver: QueryResolver,
  exportConfig: ExportConfig,
  exportedModules: Modules[],
): Record<string, any> {
  const resolvedQuery = queryResolver.getResolvedQuery();

  if (!resolvedQuery) {
    return {};
  }

  const metadata = {
    query: resolvedQuery.originalQuery,
    includeReference: exportConfig.includeReference || false,
    skipReference: exportConfig.skipReference || false,
    exportType: 'query-based',
    modulesWithQueries: resolvedQuery.modulesWithQueries,
    modulesExported: exportedModules,
    cliVersion: process.env.npm_package_version || 'unknown',
    timestamp: new Date().toISOString(),
    exportConfig: {
      branchName: exportConfig.branchName,
      stackApiKey: exportConfig.apiKey,
      region: exportConfig.region?.name,
    },
  };

  return metadata;
}

/**
 * Write query metadata to file
 */
export async function writeQueryMetadata(metadata: Record<string, any>, exportDir: string): Promise<void> {
  if (Object.keys(metadata).length === 0) {
    return;
  }

  const metadataPath = path.join(exportDir, '_query-meta.json');

  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    cliux.print(`Query metadata written to: ${metadataPath}`, { color: 'green' });
  } catch (error: any) {
    throw new CLIError(`Failed to write query metadata: ${error.message}`);
  }
}
