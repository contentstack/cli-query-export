import * as fs from 'fs';
import * as path from 'path';
import { cliux, CLIError } from '@contentstack/cli-utilities';
import { ExportConfig, Modules } from '../types';
import { QueryResolver } from './query-resolver';

export interface QueryConfig {
  originalQuery: string;
  parsedQuery: Record<string, any>;
  includeReference: boolean;
  skipReference: boolean;
  isQueryBasedExport: boolean;
  modulesWithQueries: Modules[];
}

/**
 * Create query configuration from export config
 */
export function createQueryConfig(exportConfig: ExportConfig): QueryConfig | null {
  if (!exportConfig.queryResolver) {
    return null;
  }

  const resolvedQuery = exportConfig.queryResolver.getResolvedQuery();
  if (!resolvedQuery) {
    return null;
  }

  return {
    originalQuery: JSON.stringify(resolvedQuery.originalQuery),
    parsedQuery: resolvedQuery.originalQuery,
    includeReference: exportConfig.includeReference || false,
    skipReference: exportConfig.skipReference || false,
    isQueryBasedExport: true,
    modulesWithQueries: resolvedQuery.modulesWithQueries,
  };
}

/**
 * Convert query to Content Management API format
 */
export function convertQueryToCMAFormat(parsedQuery: Record<string, any>): Record<string, any> {
  const cmaQuery: Record<string, any> = {};

  // Extract content-types query if present
  if (parsedQuery.modules && parsedQuery.modules['content-types']) {
    cmaQuery.query = parsedQuery.modules['content-types'];
  }

  return cmaQuery;
}

/**
 * Generate query metadata for export
 */
export function generateQueryMetadata(queryConfig: QueryConfig, exportConfig: ExportConfig): Record<string, any> {
  return {
    query: queryConfig.parsedQuery,
    includeReference: queryConfig.includeReference,
    skipReference: queryConfig.skipReference,
    exportType: 'query-based',
    modulesWithQueries: queryConfig.modulesWithQueries,
    modulesExported: [],
    cliVersion: process.env.npm_package_version || 'unknown',
    timestamp: new Date().toISOString(),
    exportConfig: {
      branchName: exportConfig.branchName,
      stackApiKey: exportConfig.apiKey,
      region: exportConfig.region?.name,
    },
  };
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
