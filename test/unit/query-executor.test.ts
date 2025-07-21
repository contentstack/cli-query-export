import { expect } from 'chai';
import * as sinon from 'sinon';
import { QueryExporter } from '../../src/core/query-executor';
import { QueryParser } from '../../src/utils/query-parser';
import { ModuleExporter } from '../../src/core/module-exporter';
import * as logger from '../../src/utils/logger';
import {
  ReferencedContentTypesHandler,
  ContentTypeDependenciesHandler,
  AssetReferenceHandler,
  fsUtil,
} from '../../src/utils';

describe('QueryExporter', () => {
  let sandbox: sinon.SinonSandbox;
  let queryExporter: QueryExporter;
  let mockManagementClient: any;
  let mockConfig: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock management client
    mockManagementClient = {
      stack: sandbox.stub().returns({}),
    };

    // Mock export configuration
    mockConfig = {
      exportDir: './test-export',
      stackApiKey: 'test-stack-api-key',
      managementToken: 'test-management-token',
      query: '{"modules":{"entries":{"content_type_uid":"test_page"}}}',
      modules: {
        general: ['environments', 'locales'],
        queryable: ['entries', 'assets', 'content-types'],
      },
      branchName: 'main',
      securedAssets: false,
      externalConfigPath: './config/export-config.json',
    };

    // Stub logger to prevent console output during tests
    sandbox.stub(logger, 'log');

    queryExporter = new QueryExporter(mockManagementClient, mockConfig);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should initialize QueryExporter with correct configuration', () => {
      expect(queryExporter).to.be.an('object');
      expect((queryExporter as any).exportQueryConfig).to.equal(mockConfig);
      expect((queryExporter as any).queryParser).to.be.an.instanceof(QueryParser);
      expect((queryExporter as any).moduleExporter).to.be.an.instanceof(ModuleExporter);
    });

    it('should create QueryParser instance with correct config', () => {
      const queryParser = (queryExporter as any).queryParser;
      expect(queryParser).to.be.an.instanceof(QueryParser);
    });

    it('should create ModuleExporter instance', () => {
      const moduleExporter = (queryExporter as any).moduleExporter;
      expect(moduleExporter).to.be.an.instanceof(ModuleExporter);
    });
  });

  describe('execute', () => {
    let queryParserStub: sinon.SinonStub;
    let exportGeneralModulesStub: sinon.SinonStub;
    let exportQueriedModuleStub: sinon.SinonStub;
    let exportReferencedContentTypesStub: sinon.SinonStub;
    let exportDependentModulesStub: sinon.SinonStub;
    let exportContentModulesStub: sinon.SinonStub;

    beforeEach(() => {
      queryParserStub = sandbox.stub((queryExporter as any).queryParser, 'parse').resolves({
        modules: { entries: { content_type_uid: 'test_page' } },
      });
      exportGeneralModulesStub = sandbox.stub(queryExporter as any, 'exportGeneralModules').resolves();
      exportQueriedModuleStub = sandbox.stub(queryExporter as any, 'exportQueriedModule').resolves();
      exportReferencedContentTypesStub = sandbox.stub(queryExporter as any, 'exportReferencedContentTypes').resolves();
      exportDependentModulesStub = sandbox.stub(queryExporter as any, 'exportDependentModules').resolves();
      exportContentModulesStub = sandbox.stub(queryExporter as any, 'exportContentModules').resolves();
    });

    it('should execute the complete export workflow', async () => {
      await queryExporter.execute();

      expect(queryParserStub.calledOnce).to.be.true;
      expect(exportGeneralModulesStub.calledOnce).to.be.true;
      expect(exportQueriedModuleStub.calledOnce).to.be.true;
      expect(exportReferencedContentTypesStub.calledOnce).to.be.true;
      expect(exportDependentModulesStub.calledOnce).to.be.true;
      expect(exportContentModulesStub.calledOnce).to.be.true;
    });

    it('should call methods in correct order', async () => {
      await queryExporter.execute();

      sinon.assert.callOrder(
        queryParserStub,
        exportGeneralModulesStub,
        exportQueriedModuleStub,
        exportReferencedContentTypesStub,
        exportDependentModulesStub,
        exportContentModulesStub,
      );
    });

    it('should pass parsed query to exportQueriedModule', async () => {
      const mockParsedQuery = { modules: { entries: { content_type_uid: 'test_page' } } };
      queryParserStub.resolves(mockParsedQuery);

      await queryExporter.execute();

      expect(exportQueriedModuleStub.calledWith(mockParsedQuery)).to.be.true;
    });

    it('should handle query parsing errors', async () => {
      const queryError = new Error('Invalid query format');
      queryParserStub.rejects(queryError);

      try {
        await queryExporter.execute();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Invalid query format');
      }

      expect(exportGeneralModulesStub.called).to.be.false;
    });

    it('should handle export errors and propagate them', async () => {
      const exportError = new Error('Export failed');
      exportGeneralModulesStub.rejects(exportError);

      try {
        await queryExporter.execute();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Export failed');
      }
    });
  });

  describe('exportGeneralModules', () => {
    let moduleExporterStub: sinon.SinonStub;

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();
    });

    it('should export all general modules', async () => {
      await (queryExporter as any).exportGeneralModules();

      expect(moduleExporterStub.callCount).to.equal(2);
      expect(moduleExporterStub.calledWith('environments')).to.be.true;
      expect(moduleExporterStub.calledWith('locales')).to.be.true;
    });

    it('should handle empty general modules array', async () => {
      mockConfig.modules.general = [];
      queryExporter = new QueryExporter(mockManagementClient, mockConfig);
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();

      await (queryExporter as any).exportGeneralModules();

      expect(moduleExporterStub.called).to.be.false;
    });

    it('should handle module export errors', async () => {
      const moduleError = new Error('Module export failed');
      moduleExporterStub.rejects(moduleError);

      try {
        await (queryExporter as any).exportGeneralModules();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Module export failed');
      }
    });
  });

  describe('exportQueriedModule', () => {
    let moduleExporterStub: sinon.SinonStub;

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();
    });

    it('should export queryable modules with query', async () => {
      const parsedQuery = {
        modules: {
          entries: { content_type_uid: 'test_page' },
          assets: { tags: 'featured' },
        },
      };

      await (queryExporter as any).exportQueriedModule(parsedQuery);

      expect(moduleExporterStub.callCount).to.equal(2);
      expect(moduleExporterStub.calledWith('entries', { query: parsedQuery })).to.be.true;
      expect(moduleExporterStub.calledWith('assets', { query: parsedQuery })).to.be.true;
    });

    it('should skip non-queryable modules', async () => {
      mockConfig.modules.queryable = ['entries']; // Remove assets from queryable
      queryExporter = new QueryExporter(mockManagementClient, mockConfig);
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();

      const parsedQuery = {
        modules: {
          entries: { content_type_uid: 'test_page' },
          environments: { name: 'production' }, // Not queryable
        },
      };

      await (queryExporter as any).exportQueriedModule(parsedQuery);

      expect(moduleExporterStub.callCount).to.equal(1);
      expect(moduleExporterStub.calledWith('entries', { query: parsedQuery })).to.be.true;
    });

    it('should handle empty modules in query', async () => {
      const parsedQuery = { modules: {} };

      await (queryExporter as any).exportQueriedModule(parsedQuery);

      expect(moduleExporterStub.called).to.be.false;
    });
  });

  describe('exportReferencedContentTypes', () => {
    let moduleExporterStub: sinon.SinonStub;
    let fsUtilStub: sinon.SinonStub;
    let referencedHandlerStub: any;

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();
      fsUtilStub = sandbox.stub(fsUtil, 'readFile');

      // Mock file system responses
      const mockContentTypes = [
        { uid: 'page', title: 'Page' },
        { uid: 'blog', title: 'Blog' },
      ];
      fsUtilStub.returns(mockContentTypes);
      sandbox.stub(fsUtil, 'writeFile').returns(undefined);

      // Mock ReferencedContentTypesHandler
      referencedHandlerStub = {
        extractReferencedContentTypes: sandbox.stub().resolves(['referenced_type_1', 'referenced_type_2']),
      };
      sandbox
        .stub(ReferencedContentTypesHandler.prototype, 'extractReferencedContentTypes')
        .callsFake(referencedHandlerStub.extractReferencedContentTypes);
    });

    it('should handle no referenced content types found', async () => {
      referencedHandlerStub.extractReferencedContentTypes.resolves([]);

      await (queryExporter as any).exportReferencedContentTypes();

      expect(moduleExporterStub.called).to.be.false;
    });

    it('should export new referenced content types', async () => {
      // First call returns references, second call returns empty (no more references)
      referencedHandlerStub.extractReferencedContentTypes
        .onFirstCall()
        .resolves(['new_type_1', 'new_type_2'])
        .onSecondCall()
        .resolves([]);

      await (queryExporter as any).exportReferencedContentTypes();

      expect(moduleExporterStub.calledOnce).to.be.true;
      const exportCall = moduleExporterStub.getCall(0);
      expect(exportCall.args[0]).to.equal('content-types');
      expect(exportCall.args[1].query.modules['content-types'].uid.$in).to.deep.equal(['new_type_1', 'new_type_2']);
    });

    it('should handle file system errors gracefully', async () => {
      fsUtilStub.throws(new Error('File not found'));

      try {
        await (queryExporter as any).exportReferencedContentTypes();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('File not found');
      }
    });
  });

  describe('exportDependentModules', () => {
    let moduleExporterStub: sinon.SinonStub;
    let dependenciesHandlerStub: any;

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();

      // Mock ContentTypeDependenciesHandler
      dependenciesHandlerStub = {
        extractDependencies: sandbox.stub().returns({
          globalFields: new Set(['global_field_1', 'global_field_2']),
          extensions: new Set(['extension_1']),
          taxonomies: new Set(['taxonomy_1', 'taxonomy_2']),
        }),
      };
      sandbox
        .stub(ContentTypeDependenciesHandler.prototype, 'extractDependencies')
        .callsFake(dependenciesHandlerStub.extractDependencies);
    });

    it('should export all dependency types when found', async () => {
      await (queryExporter as any).exportDependentModules();

      expect(moduleExporterStub.callCount).to.equal(3);

      // Check global fields export
      const globalFieldsCall = moduleExporterStub.getCall(0);
      expect(globalFieldsCall.args[0]).to.equal('global-fields');
      expect(globalFieldsCall.args[1].query.modules['global-fields'].uid.$in).to.deep.equal([
        'global_field_1',
        'global_field_2',
      ]);

      // Check extensions export
      const extensionsCall = moduleExporterStub.getCall(1);
      expect(extensionsCall.args[0]).to.equal('extensions');
      expect(extensionsCall.args[1].query.modules.extensions.uid.$in).to.deep.equal(['extension_1']);

      // Check taxonomies export
      const taxonomiesCall = moduleExporterStub.getCall(2);
      expect(taxonomiesCall.args[0]).to.equal('taxonomies');
      expect(taxonomiesCall.args[1].query.modules.taxonomies.uid.$in).to.deep.equal(['taxonomy_1', 'taxonomy_2']);
    });

    it('should skip empty dependency sets', async () => {
      dependenciesHandlerStub.extractDependencies.returns({
        globalFields: new Set(),
        extensions: new Set(),
        taxonomies: new Set(),
      });

      await (queryExporter as any).exportDependentModules();

      expect(moduleExporterStub.called).to.be.false;
    });

    it('should handle partial dependencies', async () => {
      dependenciesHandlerStub.extractDependencies.returns({
        globalFields: new Set(['global_field_1']),
        extensions: new Set(),
        taxonomies: new Set(['taxonomy_1']),
      });

      await (queryExporter as any).exportDependentModules();

      expect(moduleExporterStub.callCount).to.equal(2);
      expect(moduleExporterStub.calledWith('global-fields')).to.be.true;
      expect(moduleExporterStub.calledWith('taxonomies')).to.be.true;
      expect(moduleExporterStub.calledWith('extensions')).to.be.false;
    });

    it('should handle dependencies extraction errors', async () => {
      dependenciesHandlerStub.extractDependencies.throws(new Error('Dependencies extraction failed'));

      try {
        await (queryExporter as any).exportDependentModules();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Dependencies extraction failed');
      }
    });
  });

  describe('exportContentModules', () => {
    let exportEntriesStub: sinon.SinonStub;
    let exportReferencedAssetsStub: sinon.SinonStub;
    let setTimeoutStub: sinon.SinonStub;

    beforeEach(() => {
      exportEntriesStub = sandbox.stub(queryExporter as any, 'exportEntries').resolves();
      exportReferencedAssetsStub = sandbox.stub(queryExporter as any, 'exportReferencedAssets').resolves();

      // Mock setTimeout to avoid actual delays in tests
      setTimeoutStub = sandbox.stub(global, 'setTimeout').callsFake((callback) => {
        callback();
        return {} as any;
      });
    });

    it('should export entries and then assets', async () => {
      await (queryExporter as any).exportContentModules();

      expect(exportEntriesStub.calledOnce).to.be.true;
      expect(exportReferencedAssetsStub.calledOnce).to.be.true;
      sinon.assert.callOrder(exportEntriesStub, exportReferencedAssetsStub);
    });

    it('should include delay before asset export', async () => {
      await (queryExporter as any).exportContentModules();

      expect(setTimeoutStub.calledOnce).to.be.true;
      expect(setTimeoutStub.calledWith(sinon.match.func, 10000)).to.be.true;
    });

    it('should handle entries export errors', async () => {
      const entriesError = new Error('Entries export failed');
      exportEntriesStub.rejects(entriesError);

      try {
        await (queryExporter as any).exportContentModules();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Entries export failed');
      }

      expect(exportReferencedAssetsStub.called).to.be.false;
    });

    it('should handle assets export errors', async () => {
      const assetsError = new Error('Assets export failed');
      exportReferencedAssetsStub.rejects(assetsError);

      try {
        await (queryExporter as any).exportContentModules();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Assets export failed');
      }
    });
  });

  describe('exportEntries', () => {
    let moduleExporterStub: sinon.SinonStub;

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();
    });

    it('should export entries module', async () => {
      await (queryExporter as any).exportEntries();

      expect(moduleExporterStub.calledOnce).to.be.true;
      expect(moduleExporterStub.calledWith('entries')).to.be.true;
    });

    it('should handle entries export errors', async () => {
      const entriesError = new Error('Entries export failed');
      moduleExporterStub.rejects(entriesError);

      try {
        await (queryExporter as any).exportEntries();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Entries export failed');
      }
    });
  });

  describe('exportReferencedAssets', () => {
    let moduleExporterStub: sinon.SinonStub;
    let assetHandlerStub: any;

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();

      // Mock AssetReferenceHandler
      assetHandlerStub = {
        extractReferencedAssets: sandbox.stub().returns(['asset_1', 'asset_2', 'asset_3']),
      };
      sandbox
        .stub(AssetReferenceHandler.prototype, 'extractReferencedAssets')
        .callsFake(assetHandlerStub.extractReferencedAssets);
    });

    it('should export referenced assets when found', async () => {
      await (queryExporter as any).exportReferencedAssets();

      expect(moduleExporterStub.calledOnce).to.be.true;
      const exportCall = moduleExporterStub.getCall(0);
      expect(exportCall.args[0]).to.equal('assets');
      expect(exportCall.args[1].query.modules.assets.uid.$in).to.deep.equal(['asset_1', 'asset_2', 'asset_3']);
    });

    it('should skip export when no assets found', async () => {
      assetHandlerStub.extractReferencedAssets.returns([]);

      await (queryExporter as any).exportReferencedAssets();

      expect(moduleExporterStub.called).to.be.false;
    });

    it('should handle asset extraction errors', async () => {
      const assetError = new Error('Asset extraction failed');
      assetHandlerStub.extractReferencedAssets.throws(assetError);

      try {
        await (queryExporter as any).exportReferencedAssets();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Asset extraction failed');
      }

      expect(moduleExporterStub.called).to.be.false;
    });

    it('should handle asset export errors', async () => {
      const exportError = new Error('Asset export failed');
      moduleExporterStub.rejects(exportError);

      try {
        await (queryExporter as any).exportReferencedAssets();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Asset export failed');
      }
    });
  });
});
