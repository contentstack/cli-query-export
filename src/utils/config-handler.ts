import { ExportQueryConfig } from '../types';
import { sanitizePath, pathValidator, configHandler, isAuthenticated } from '@contentstack/cli-utilities';
import config from '../config';

export async function setupExportConfig(flags: any): Promise<ExportQueryConfig> {
  const exportDir = sanitizePath(flags['data-dir'] || pathValidator('export'));

  const exportConfig: ExportQueryConfig = {
    ...config,
    exportDir,
    stackApiKey: flags['stack-api-key'] || '',
    managementToken: flags.alias ? configHandler.get(`tokens.${flags.alias}`)?.token : undefined,
    queryInput: flags.query,
    skipReferences: flags['skip-references'] || false,
    skipDependencies: flags['skip-dependencies'] || false,
    branchName: flags.branch,
    securedAssets: flags['secured-assets'] || false,
    isQueryBasedExport: true,
  };

  // Handle authentication
  if (flags.alias) {
    const tokenData = configHandler.get(`tokens.${flags.alias}`);
    if (!tokenData?.token) {
      throw new Error(`No management token found for alias ${flags.alias}`);
    }
    exportConfig.managementToken = tokenData.token;
    exportConfig.stackApiKey = tokenData.apiKey || exportConfig.stackApiKey;
  }

  if (!exportConfig.managementToken && !isAuthenticated()) {
    throw new Error('Please login or provide an alias for the management token');
  }

  if (!exportConfig.stackApiKey) {
    throw new Error('Stack API key is required');
  }

  return exportConfig;
}
