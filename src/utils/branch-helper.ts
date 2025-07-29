import * as path from 'path';
import { sanitizePath } from '@contentstack/cli-utilities';
import { QueryExportConfig } from '../types';
import { fsUtil } from './file-helper';
import { log } from './logger';

/**
 * Validates and sets up branch configuration for the stack
 *
 * @param config The export configuration
 * @param stackAPIClient The stack API client
 * @returns Promise that resolves when branch setup is complete
 */
export const setupBranches = async (config: QueryExportConfig, stackAPIClient: any): Promise<void> => {
  if (typeof config !== 'object') {
    throw new Error('Invalid config to setup the branch');
  }

  try {
    if (config.branchName) {
      // Check if the specified branch exists
      log(config, `Validating branch: ${config.branchName}`, 'info');

      const result = await stackAPIClient
        .branch(config.branchName)
        .fetch()
        .catch((err: Error): any => {
          log(config, `Error fetching branch: ${err.message}`, 'error');
          return null;
        });

      if (result && typeof result === 'object') {
        log(config, `Branch '${config.branchName}' found`, 'success');
      } else {
        throw new Error(`No branch found with the name '${config.branchName}'`);
      }
    } else {
      // If no branch name provided, check if the stack has branches
      log(config, 'No branch specified, checking if stack has branches', 'info');

      const result = await stackAPIClient
        .branch()
        .query()
        .find()
        .catch((err: Error): any => {
          return null;
        });

      if (result && result.items && Array.isArray(result.items) && result.items.length > 0) {
        // Set default branch to 'main' if it exists
        config.branchName = 'main';
      } else {
        // Stack doesn't have branches
        log(config, 'Stack does not have branches', 'info');
        return;
      }
    }
    config.branchEnabled = true;
  } catch (error) {
    log(config, `Error setting up branches: ${error.message}`, 'error');
    throw error;
  }
};

export default setupBranches;
