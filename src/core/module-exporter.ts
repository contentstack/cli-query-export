import { formatError, log } from '@contentstack/cli-utilities';
import ExportCommand from '@contentstack/cli-cm-export';
import { QueryExportConfig, Modules, ExportOptions } from '../types';
import { createLogContext } from '../utils/logger';


export class ModuleExporter {
  private exportQueryConfig: QueryExportConfig;
  private exportedModules: string[] = [];
  private logContext: any;

  constructor(exportQueryConfig: QueryExportConfig) {
    this.exportQueryConfig = exportQueryConfig;
    this.logContext = createLogContext(exportQueryConfig);
  }

  async exportModule(moduleName: Modules, options: ExportOptions = {}): Promise<void> {
    try {
      log.info(`Exporting module: ${moduleName}`, this.logContext);
      log.debug(`Building export command for module: ${moduleName}`, this.logContext);

      // Build command arguments
      const cmd = this.buildExportCommand(moduleName, options);

      // Configurable delay
      const delay = this.exportQueryConfig.exportDelayMs || 2000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Create export command instance
      await ExportCommand.run(cmd);
      log.debug(`Export command completed for module: ${moduleName}`, this.logContext);

      // Read the exported data
      // const data = await this.readExportedData(moduleName, options);

      if (!this.exportedModules.includes(moduleName)) {
        this.exportedModules.push(moduleName);
      }

      // success message
      log.info(`Successfully exported ${moduleName}`, this.logContext);
    } catch (error) {
      log.error(`Failed to export ${moduleName}: ${formatError(error)}`, this.logContext);
      throw error;
    }
  }

  /**
   * Build export command arguments based on module and options
   */
  private buildExportCommand(moduleName: Modules, options: ExportOptions): string[] {
    const cmd: string[] = [];

    // Stack API key (required)
    cmd.push('-k', this.exportQueryConfig.stackApiKey);

    // Directory
    const directory = options.directory || this.exportQueryConfig.exportDir;
    cmd.push('-d', directory);

    // Module
    cmd.push('--module', moduleName);

    // Alias (management token)
    if (options.alias) {
      cmd.push('-a', options.alias);
    }

    // Branch
    if (options.branch || this.exportQueryConfig.branchName) {
      cmd.push('--branch', options.branch || this.exportQueryConfig.branchName);
    }

    // Query (if provided)
    if (options.query) {
      cmd.push('--query', JSON.stringify(options.query));
    }

    // Secured assets
    if (options.securedAssets || this.exportQueryConfig.securedAssets) {
      cmd.push('--secured-assets');
    }

    // External config file
    const externalConfigPath = options.configPath || this.exportQueryConfig.externalConfigPath;
    if (externalConfigPath) {
      cmd.push('--config', externalConfigPath);
    }

    // Auto confirm
    cmd.push('-y');

    return cmd;
  }
}
