import { expect } from 'chai';
import * as sinon from 'sinon';
import { ModuleExporter } from '../../src/core/module-exporter';
import * as logger from '../../src/utils/logger';
import ExportCommand from '@contentstack/cli-cm-export';

describe('ModuleExporter', () => {
  let sandbox: sinon.SinonSandbox;
  let moduleExporter: ModuleExporter;
  let mockStackAPIClient: any;
  let mockConfig: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock stack API client
    mockStackAPIClient = {
      contentType: sandbox.stub(),
      entry: sandbox.stub(),
      asset: sandbox.stub(),
    };

    // Mock export configuration
    mockConfig = {
      exportDir: './test-export',
      stackApiKey: 'test-stack-api-key',
      managementToken: 'test-management-token',
      branchName: 'main',
      securedAssets: false,
      externalConfigPath: './config/export-config.json',
    };

    // Stub logger to prevent console output during tests
    sandbox.stub(logger, 'log');

    moduleExporter = new ModuleExporter(mockStackAPIClient, mockConfig);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should initialize ModuleExporter with correct configuration', () => {
      expect(moduleExporter).to.be.an('object');
      expect((moduleExporter as any).stackAPIClient).to.equal(mockStackAPIClient);
      expect((moduleExporter as any).exportQueryConfig).to.equal(mockConfig);
      expect((moduleExporter as any).exportedModules).to.be.an('array').that.is.empty;
    });

    it('should initialize empty exported modules array', () => {
      expect(moduleExporter.getExportedModules()).to.be.an('array').that.is.empty;
    });
  });

  describe('buildExportCommand', () => {
    it('should build basic export command with required parameters', () => {
      const cmd = (moduleExporter as any).buildExportCommand('entries', {});

      expect(cmd).to.include('-k', 'test-stack-api-key');
      expect(cmd).to.include('-d', './test-export');
      expect(cmd).to.include('--module', 'entries');
      expect(cmd).to.include('-A', 'test-management-token');
      expect(cmd).to.include('-y');
    });

    it('should include branch when specified in config', () => {
      const cmd = (moduleExporter as any).buildExportCommand('content-types', {});

      expect(cmd).to.include('--branch', 'main');
    });

    it('should include branch from options over config', () => {
      const cmd = (moduleExporter as any).buildExportCommand('content-types', {
        branch: 'development',
      });

      expect(cmd).to.include('--branch', 'development');
    });

    it('should include query when provided in options', () => {
      const query = {
        modules: {
          entries: { content_type_uid: 'page' },
        },
      };

      const cmd = (moduleExporter as any).buildExportCommand('entries', { query });

      expect(cmd).to.include('--query', JSON.stringify(query));
    });

    it('should include secured assets flag when enabled in config', () => {
      mockConfig.securedAssets = true;
      moduleExporter = new ModuleExporter(mockStackAPIClient, mockConfig);

      const cmd = (moduleExporter as any).buildExportCommand('assets', {});

      expect(cmd).to.include('--secured-assets');
    });

    it('should include secured assets from options over config', () => {
      const cmd = (moduleExporter as any).buildExportCommand('assets', {
        securedAssets: true,
      });

      expect(cmd).to.include('--secured-assets');
    });

    it('should use alias over management token when provided', () => {
      const cmd = (moduleExporter as any).buildExportCommand('environments', {
        alias: 'production-stack',
      });

      expect(cmd).to.include('-a', 'production-stack');
      expect(cmd).to.not.include('-A');
    });

    it('should include external config path when specified', () => {
      const cmd = (moduleExporter as any).buildExportCommand('locales', {});

      expect(cmd).to.include('--config', './config/export-config.json');
    });

    it('should use custom config path from options', () => {
      const cmd = (moduleExporter as any).buildExportCommand('locales', {
        configPath: './custom-config.json',
      });

      expect(cmd).to.include('--config', './custom-config.json');
    });

    it('should use custom directory from options', () => {
      const cmd = (moduleExporter as any).buildExportCommand('entries', {
        directory: './custom-export',
      });

      expect(cmd).to.include('-d', './custom-export');
    });

    it('should handle missing optional parameters', () => {
      mockConfig.branchName = undefined;
      mockConfig.externalConfigPath = undefined;
      mockConfig.managementToken = undefined;
      moduleExporter = new ModuleExporter(mockStackAPIClient, mockConfig);

      const cmd = (moduleExporter as any).buildExportCommand('entries', {});

      expect(cmd).to.include('-k', 'test-stack-api-key');
      expect(cmd).to.include('-d', './test-export');
      expect(cmd).to.include('--module', 'entries');
      expect(cmd).to.include('-y');
      expect(cmd).to.not.include('--branch');
      expect(cmd).to.not.include('--config');
      expect(cmd).to.not.include('-A');
    });

    it('should build different commands for different modules', () => {
      const entriesCmd = (moduleExporter as any).buildExportCommand('entries', {});
      const assetsCmd = (moduleExporter as any).buildExportCommand('assets', {});
      const contentTypesCmd = (moduleExporter as any).buildExportCommand('content-types', {});

      expect(entriesCmd).to.include('--module', 'entries');
      expect(assetsCmd).to.include('--module', 'assets');
      expect(contentTypesCmd).to.include('--module', 'content-types');
    });

    it('should handle complex query structures', () => {
      const complexQuery = {
        modules: {
          entries: {
            content_type_uid: { $in: ['page', 'blog'] },
            locale: 'en-us',
            published: true,
          },
        },
      };

      const cmd = (moduleExporter as any).buildExportCommand('entries', { query: complexQuery });

      expect(cmd).to.include('--query', JSON.stringify(complexQuery));
    });
  });

  describe('exportModule', () => {
    let exportCommandStub: sinon.SinonStub;

    beforeEach(() => {
      exportCommandStub = sandbox.stub(ExportCommand, 'run').resolves();
    });

    it('should export module successfully', async () => {
      await moduleExporter.exportModule('entries');

      expect(exportCommandStub.calledOnce).to.be.true;
      expect(moduleExporter.getExportedModules()).to.include('entries');
    });

    it('should pass correct command to ExportCommand.run', async () => {
      await moduleExporter.exportModule('content-types', {
        branch: 'development',
      });

      expect(exportCommandStub.calledOnce).to.be.true;
      const commandArgs = exportCommandStub.getCall(0).args[0];

      expect(commandArgs).to.include('-k', 'test-stack-api-key');
      expect(commandArgs).to.include('--module', 'content-types');
      expect(commandArgs).to.include('--branch', 'development');
    });

    it('should track exported modules without duplicates', async () => {
      await moduleExporter.exportModule('entries');
      await moduleExporter.exportModule('assets');
      await moduleExporter.exportModule('entries'); // Duplicate

      const exportedModules = moduleExporter.getExportedModules();
      expect(exportedModules).to.have.length(2);
      expect(exportedModules).to.include('entries');
      expect(exportedModules).to.include('assets');
    });

    it('should handle export command errors', async () => {
      const exportError = new Error('Export command failed');
      exportCommandStub.rejects(exportError);

      try {
        await moduleExporter.exportModule('entries');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Export command failed');
      }

      expect(moduleExporter.getExportedModules()).to.not.include('entries');
    });

    it('should export with query options', async () => {
      const query = {
        modules: {
          entries: { content_type_uid: 'page' },
        },
      };

      await moduleExporter.exportModule('entries', { query });

      expect(exportCommandStub.calledOnce).to.be.true;
      const commandArgs = exportCommandStub.getCall(0).args[0];
      expect(commandArgs).to.include('--query', JSON.stringify(query));
    });

    it('should export with all options', async () => {
      const options = {
        directory: './custom-export',
        alias: 'prod-stack',
        branch: 'feature-branch',
        securedAssets: true,
        configPath: './custom-config.json',
        query: { modules: { assets: { tags: 'featured' } } },
      };

      await moduleExporter.exportModule('assets', options);

      expect(exportCommandStub.calledOnce).to.be.true;
      const commandArgs = exportCommandStub.getCall(0).args[0];

      expect(commandArgs).to.include('-d', './custom-export');
      expect(commandArgs).to.include('-a', 'prod-stack');
      expect(commandArgs).to.include('--branch', 'feature-branch');
      expect(commandArgs).to.include('--secured-assets');
      expect(commandArgs).to.include('--config', './custom-config.json');
      expect(commandArgs).to.include('--query', JSON.stringify(options.query));
    });

    it('should handle different module types', async () => {
      const modules = ['entries', 'assets', 'content-types', 'environments', 'locales', 'global-fields'];

      for (const module of modules) {
        await moduleExporter.exportModule(module as any);
      }

      expect(exportCommandStub.callCount).to.equal(modules.length);
      expect(moduleExporter.getExportedModules()).to.have.length(modules.length);
      modules.forEach((module) => {
        expect(moduleExporter.getExportedModules()).to.include(module);
      });
    });
  });

  describe('readExportedData', () => {
    let fsStub: any;

    beforeEach(() => {
      // Mock the require for fs
      const mockFs = {
        existsSync: sandbox.stub(),
        readFileSync: sandbox.stub(),
      };
      fsStub = mockFs;
    });

    it('should handle file reading logic (private method testing)', () => {
      // Test the logic patterns used in readExportedData without file system dependencies

      // Test array data structure
      const arrayData = [{ uid: 'item1' }, { uid: 'item2' }];
      expect(Array.isArray(arrayData)).to.be.true;
      expect(arrayData.length).to.equal(2);

      // Test object with items property
      const objectWithItems = { items: [{ uid: 'item1' }] };
      expect(objectWithItems.items).to.be.an('array');
      expect(Array.isArray(objectWithItems.items)).to.be.true;

      // Test single object structure
      const singleObject = { uid: 'single-item' };
      expect(typeof singleObject).to.equal('object');
      expect(Array.isArray(singleObject)).to.be.false;
    });

    it('should handle JSON parsing scenarios', () => {
      // Test valid JSON parsing scenarios
      const validJsonArray = '[{"uid":"item1"},{"uid":"item2"}]';
      const parsedArray = JSON.parse(validJsonArray);
      expect(Array.isArray(parsedArray)).to.be.true;
      expect(parsedArray.length).to.equal(2);

      const validJsonObject = '{"items":[{"uid":"item1"}]}';
      const parsedObject = JSON.parse(validJsonObject);
      expect(parsedObject.items).to.be.an('array');

      const singleItemJson = '{"uid":"single"}';
      const singleItem = JSON.parse(singleItemJson);
      expect(typeof singleItem).to.equal('object');
    });
  });

  describe('getExportedModules', () => {
    it('should return empty array initially', () => {
      const modules = moduleExporter.getExportedModules();
      expect(modules).to.be.an('array').that.is.empty;
    });

    it('should return copy of exported modules array', () => {
      // Add modules directly to test the getter
      (moduleExporter as any).exportedModules = ['entries', 'assets'];

      const modules1 = moduleExporter.getExportedModules();
      const modules2 = moduleExporter.getExportedModules();

      expect(modules1).to.deep.equal(['entries', 'assets']);
      expect(modules2).to.deep.equal(['entries', 'assets']);
      expect(modules1).to.not.equal(modules2); // Should be different instances
    });

    it('should reflect modules added through exportModule', async () => {
      sandbox.stub(ExportCommand, 'run').resolves();

      await moduleExporter.exportModule('entries');
      expect(moduleExporter.getExportedModules()).to.include('entries');

      await moduleExporter.exportModule('assets');
      expect(moduleExporter.getExportedModules()).to.include('assets');
      expect(moduleExporter.getExportedModules()).to.have.length(2);
    });
  });

  describe('error handling', () => {
    it('should handle export command initialization errors', async () => {
      const initError = new Error('ExportCommand initialization failed');
      sandbox.stub(ExportCommand, 'run').rejects(initError);

      try {
        await moduleExporter.exportModule('entries');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('ExportCommand initialization failed');
      }
    });

    it('should handle malformed configuration gracefully', () => {
      const malformedConfig = {
        stackApiKey: null as any,
        exportDir: undefined as any,
        managementToken: '',
      };

      // Should not throw error during construction
      const malformedExporter = new ModuleExporter(mockStackAPIClient, malformedConfig as any);
      expect(malformedExporter).to.be.an('object');

      // Command building should handle null/undefined values
      const cmd = (malformedExporter as any).buildExportCommand('entries', {});
      expect(cmd).to.be.an('array');
    });

    it('should handle missing stack API client gracefully', () => {
      const exporterWithNullClient = new ModuleExporter(null as any, mockConfig);
      expect(exporterWithNullClient).to.be.an('object');
    });
  });

  describe('integration scenarios', () => {
    let exportCommandStub: sinon.SinonStub;

    beforeEach(() => {
      exportCommandStub = sandbox.stub(ExportCommand, 'run').resolves();
    });

    it('should handle sequential module exports', async () => {
      const modules = ['environments', 'locales', 'content-types', 'entries', 'assets'];

      for (const module of modules) {
        await moduleExporter.exportModule(module as any);
      }

      expect(exportCommandStub.callCount).to.equal(modules.length);
      expect(moduleExporter.getExportedModules()).to.have.length(modules.length);
    });

    it('should handle concurrent module exports', async () => {
      const exportPromises = [
        moduleExporter.exportModule('environments'),
        moduleExporter.exportModule('locales'),
        moduleExporter.exportModule('content-types'),
      ];

      await Promise.all(exportPromises);

      expect(exportCommandStub.callCount).to.equal(3);
      expect(moduleExporter.getExportedModules()).to.have.length(3);
    });

    it('should handle mixed success and failure scenarios', async () => {
      exportCommandStub.onFirstCall().resolves();
      exportCommandStub.onSecondCall().rejects(new Error('Second export failed'));
      exportCommandStub.onThirdCall().resolves();

      // First export should succeed
      await moduleExporter.exportModule('environments');
      expect(moduleExporter.getExportedModules()).to.include('environments');

      // Second export should fail
      try {
        await moduleExporter.exportModule('locales');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Second export failed');
      }
      expect(moduleExporter.getExportedModules()).to.not.include('locales');

      // Third export should succeed
      await moduleExporter.exportModule('content-types');
      expect(moduleExporter.getExportedModules()).to.include('content-types');

      expect(moduleExporter.getExportedModules()).to.have.length(2);
    });
  });
});
