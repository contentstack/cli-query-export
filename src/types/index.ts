import { ContentstackClient } from '@contentstack/cli-utilities';
import ExportConfig from './export-config';

// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface AuthOptions {
  contentstackClient: any;
}

export interface ContentStackManagementClient {
  contentstackClient: object;
}

export interface PrintOptions {
  color?: string;
}

export interface InquirePayload {
  type: string;
  name: string;
  message: string;
  choices?: Array<any>;
  transformer?: Function;
}

export interface User {
  email: string;
  authtoken: string;
}

export interface Region {
  name: string;
  cma: string;
  cda: string;
  uiHost: string;
}

export type Modules =
  | 'stack'
  | 'locales'
  | 'environments'
  | 'content-types'
  | 'global-fields'
  | 'extensions'
  | 'taxonomies'
  | 'entries'
  | 'assets'
  | 'webhooks'
  | 'workflows'
  | 'custom-roles'
  | 'labels'
  | 'marketplace-apps'
  | 'personalize';

export interface ModuleQueryConfig {
  supportedFields: string[];
  supportedOperators: string[];
  defaultLimit: number;
  includeGlobalFieldSchema?: boolean;
  includePublishDetails?: boolean;
  includeDimension?: boolean;
}

export interface DependencyAnalysisConfig {
  enabled: boolean;
  fields?: string[];
  extractors?: string[];
}

export interface ModuleDefinition {
  dirName: string;
  fileName: string;
  apiEndpoint: string;
  queryable: boolean;
  dependencies: Modules[];
  queryConfig?: ModuleQueryConfig;
  dependencyAnalysis?: DependencyAnalysisConfig;
  limit?: number;
  batchLimit?: number;
}

export interface DependencyExtractor {
  fieldType: string;
  extract: (data: any) => string[];
  targetModule: Modules;
}

export interface ExportQueryConfig {
  // Basic settings
  contentVersion: number;
  host: string;

  // Export settings
  exportDir: string;
  stackApiKey: string;
  managementToken?: string;
  region?: Region;
  branchName?: string;
  securedAssets?: boolean;

  // Query settings
  query?: string;
  queryInput?: string;
  skipReferences?: boolean;
  skipDependencies?: boolean;
  isQueryBasedExport?: boolean;

  // Module configuration
  modules: {
    // Module capabilities
    capabilities: {
      general: Modules[];
      queryable: Modules[];
      dependent: Modules[];
      content: Modules[];
    };

    // Export order
    exportOrder: Modules[];

    // Module definitions
    definitions: Record<Modules, ModuleDefinition>;
  };

  // Query-specific settings
  queryConfig: {
    maxRecursionDepth: number;
    batchSize: number;
    metadataFileName: string;
    defaultOperators: string[];
    validation: {
      maxQueryDepth: number;
      maxArraySize: number;
      allowedDateFormats: string[];
    };
  };

  // Dependency extraction rules
  dependencyExtractors: Record<string, DependencyExtractor>;

  // Performance settings
  fetchConcurrency: number;
  writeConcurrency: number;

  // Optional settings
  developerHubBaseUrl?: string;
  branches?: Array<{ uid: string; source: string }>;
  branchEnabled?: boolean;
  branchDir?: string;
}

export interface QueryMetadata {
  query: any;
  flags: {
    skipReferences: boolean;
    skipDependencies: boolean;
  };
  timestamp: string;
  cliVersion: string;
  exportedModules: string[];
  contentTypes: Array<{
    uid: string;
    title: string;
  }>;
  summary: {
    totalContentTypes: number;
    totalModules: number;
  };
}

export { default as DefaultConfig } from './default-config';
export { default as ExportConfig } from './export-config';
export * from './marketplace-app';
