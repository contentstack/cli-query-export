import { Command } from '@contentstack/cli-command';
import {
  flags,
  FlagInput,
  sanitizePath,
  formatError,
  managementSDKClient,
  ContentstackClient,
} from '@contentstack/cli-utilities';
import { QueryExporter } from '../../../core/query-executor';
import { QueryExportConfig } from '../../../types';
import { log, setupQueryExportConfig } from '../../../utils';

export default class ExportQueryCommand extends Command {
  static description = 'Export content from a stack using query-based filtering';
  private exportDir: string;

  static examples = [
    'csdx cm:stacks:export-query --query \'{"modules":{"content-types":{"title":{"$in":["Blog","Author"]}}}}\'',
    'csdx cm:stacks:export-query --query ./ct-query.json --skip-references',
    'csdx cm:stacks:export-query --alias <alias> --query \'{"modules":{"entries":{"content_type_uid":"blog"}}}\'',
    'csdx cm:stacks:export-query --query \'{"modules":{"assets":{"title":{"$regex":"image"}}}}\'',
  ];

  static usage = 'cm:stacks:export-query --query <value> [options]';

  static flags: FlagInput = {
    config: flags.string({
      char: 'c',
      description: 'Path to the configuration file',
    }),
    'stack-api-key': flags.string({
      char: 'k',
      description: 'Stack API key',
    }),
    'data-dir': flags.string({
      char: 'd',
      description: 'Path to store exported content',
    }),
    alias: flags.string({
      char: 'a',
      description: 'Management token alias',
    }),
    branch: flags.string({
      description: 'Branch name to export from',
    }),
    query: flags.string({
      required: true,
      description: 'Query as JSON string or file path',
    }),
    'skip-references': flags.boolean({
      description: 'Skip referenced content types',
    }),
    'skip-dependencies': flags.boolean({
      description: 'Skip dependent modules (global-fields, extensions, taxonomies)',
    }),
    'secured-assets': flags.boolean({
      description: 'Export secured assets',
    }),
    yes: flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompts',
    }),
  };

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(ExportQueryCommand);

      // Setup export configuration
      const exportQueryConfig = await setupQueryExportConfig(flags);
      exportQueryConfig.host = this.cmaHost;
      exportQueryConfig.region = this.region;

      if (this.developerHubUrl) {
        exportQueryConfig.developerHubBaseUrl = this.developerHubUrl;
      }

      this.exportDir = sanitizePath(exportQueryConfig.exportDir);
      // Initialize and run query export
      const managementAPIClient: ContentstackClient = await managementSDKClient(exportQueryConfig);
      const queryExporter = new QueryExporter(managementAPIClient, exportQueryConfig);
      await queryExporter.execute();

      log(exportQueryConfig, 'Query-based export completed successfully!', 'success');
      log(exportQueryConfig, `Export files saved to: ${this.exportDir}`, 'info');
    } catch (error) {
      log({ exportDir: this.exportDir } as QueryExportConfig, `Export failed: ${formatError(error)}`, 'error');
      throw error;
    }
  }
}
