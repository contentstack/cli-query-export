import { Command } from '@contentstack/cli-command';
import {
  cliux,
  messageHandler,
  managementSDKClient,
  flags,
  ContentstackClient,
  FlagInput,
  pathValidator,
  sanitizePath,
} from '@contentstack/cli-utilities';
import { QueryRunner } from '../../../core/query-runner';
import { ExportQueryConfig } from '../../../types';
import { setupExportConfig } from '../../../utils/config-handler';
import { log, formatError } from '../../../utils/logger';

export default class ExportQueryCommand extends Command {
  static description = 'Export content from a stack using query-based filtering';

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

  static aliases = ['cm:export-query'];

  async run(): Promise<void> {
    let exportDir = pathValidator('logs');

    try {
      const { flags } = await this.parse(ExportQueryCommand);

      // Setup export configuration
      const exportConfig = await setupExportConfig(flags);
      exportConfig.host = this.cmaHost;
      exportConfig.region = this.region;

      if (this.developerHubUrl) {
        exportConfig.developerHubBaseUrl = this.developerHubUrl;
      }

      exportDir = sanitizePath(exportConfig.exportDir);

      // Initialize management API client
      const managementAPIClient: ContentstackClient = await managementSDKClient(exportConfig);

      // Initialize and run query export
      const queryRunner = new QueryRunner(managementAPIClient, exportConfig);
      await queryRunner.execute();

      log(exportConfig, 'Query-based export completed successfully!', 'success');
      log(exportConfig, `Export files saved to: ${exportDir}`, 'info');
    } catch (error) {
      log({ exportDir } as ExportQueryConfig, `Export failed: ${formatError(error)}`, 'error');
      throw error;
    }
  }
}
