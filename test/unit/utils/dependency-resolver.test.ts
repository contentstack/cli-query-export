import { expect } from 'chai';
import * as sinon from 'sinon';
import { ContentTypeDependenciesHandler } from '../../../src/utils/dependency-resolver';
import { QueryExportConfig } from '../../../src/types';

describe('Dependency Resolver Utilities', () => {
  let handler: ContentTypeDependenciesHandler;
  let mockConfig: QueryExportConfig;
  let mockStackAPIClient: any;

  beforeEach(() => {
    // Create a mock stack API client
    mockStackAPIClient = {
      extension: sinon.stub().returns({
        query: sinon.stub().returns({
          find: sinon.stub().resolves({
            items: [],
          }),
        }),
      }),
    };

    mockConfig = {
      maxCTReferenceDepth: 20,
      contentVersion: 2,
      host: 'https://api.contentstack.io/v3',
      exportDir: '/test/export',
      stackApiKey: 'test-api-key',
      managementToken: 'test-token',
      query: '',
      skipReferences: false,
      skipDependencies: false,
      branchName: 'main',
      securedAssets: false,
      isQueryBasedExport: true,
      logsPath: '/test/logs',
      dataPath: '/test/data',
      modules: {
        general: ['stack', 'locales', 'environments'],
        queryable: ['content-types'],
        dependent: ['global-fields', 'extensions', 'taxonomies'],
        content: ['entries', 'assets'],
        exportOrder: ['stack', 'content-types'],
      },
      queryConfig: {
        maxRecursionDepth: 10,
        batchSize: 100,
        metadataFileName: '_query-meta.json',
        validation: {
          maxQueryDepth: 5,
          maxArraySize: 1000,
          allowedDateFormats: ['ISO8601'],
        },
      },
      fetchConcurrency: 5,
      writeConcurrency: 5,
      apis: {
        stacks: '/stacks/',
        locales: '/locales/',
        environments: '/environments/',
        content_types: '/content_types/',
        global_fields: '/global_fields/',
        extensions: '/extensions/',
        taxonomies: '/taxonomies/',
        entries: '/entries/',
        assets: '/assets/',
      },
    };

    // Fix: Pass both required arguments to the constructor
    handler = new ContentTypeDependenciesHandler(mockStackAPIClient, mockConfig);
  });

  describe('Schema dependency extraction logic', () => {
    it('should extract global field dependencies from schema', () => {
      const schema = [
        {
          uid: 'seo',
          data_type: 'global_field',
          reference_to: 'seo_fields',
        },
        {
          uid: 'metadata',
          data_type: 'global_field',
          reference_to: 'common_metadata',
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      // Access private method for testing
      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('seo_fields')).to.be.true;
      expect(dependencies.globalFields.has('common_metadata')).to.be.true;
      expect(dependencies.globalFields.size).to.equal(2);
    });

    it('should extract extension dependencies from schema', () => {
      const schema = [
        {
          uid: 'rich_text',
          data_type: 'text',
          extension_uid: 'rich_text_editor',
        },
        {
          uid: 'color_picker',
          data_type: 'text',
          extension_uid: 'color_picker_ext',
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.extensions.has('rich_text_editor')).to.be.true;
      expect(dependencies.extensions.has('color_picker_ext')).to.be.true;
      expect(dependencies.extensions.size).to.equal(2);
    });

    it('should extract taxonomy dependencies from schema', () => {
      const schema = [
        {
          uid: 'categories',
          data_type: 'taxonomy',
          taxonomies: [{ taxonomy_uid: 'product_categories' }, { taxonomy_uid: 'product_tags' }],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.taxonomies.has('product_categories')).to.be.true;
      expect(dependencies.taxonomies.has('product_tags')).to.be.true;
      expect(dependencies.taxonomies.size).to.equal(2);
    });

    it('should handle group fields with nested dependencies', () => {
      const schema = [
        {
          uid: 'content_section',
          data_type: 'group',
          schema: [
            {
              uid: 'seo',
              data_type: 'global_field',
              reference_to: 'nested_seo',
            },
            {
              uid: 'rich_content',
              data_type: 'text',
              extension_uid: 'nested_editor',
            },
          ],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('nested_seo')).to.be.true;
      expect(dependencies.extensions.has('nested_editor')).to.be.true;
    });

    it('should handle block fields with nested dependencies', () => {
      const schema = [
        {
          uid: 'content_blocks',
          data_type: 'blocks',
          blocks: {
            hero_block: {
              schema: [
                {
                  uid: 'seo',
                  data_type: 'global_field',
                  reference_to: 'hero_seo',
                },
              ],
            },
            content_block: {
              schema: [
                {
                  uid: 'editor',
                  data_type: 'text',
                  extension_uid: 'content_editor',
                },
                {
                  uid: 'tags',
                  data_type: 'taxonomy',
                  taxonomies: [{ taxonomy_uid: 'content_tags' }],
                },
              ],
            },
          },
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('hero_seo')).to.be.true;
      expect(dependencies.extensions.has('content_editor')).to.be.true;
      expect(dependencies.taxonomies.has('content_tags')).to.be.true;
    });

    it('should handle complex nested structures', () => {
      const schema = [
        {
          uid: 'sections',
          data_type: 'group',
          schema: [
            {
              uid: 'content_blocks',
              data_type: 'blocks',
              blocks: {
                nested_block: {
                  schema: [
                    {
                      uid: 'nested_group',
                      data_type: 'group',
                      schema: [
                        {
                          uid: 'deep_global',
                          data_type: 'global_field',
                          reference_to: 'deep_nested_global',
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('deep_nested_global')).to.be.true;
    });

    it('should ignore fields without dependency information', () => {
      const schema = [
        {
          uid: 'title',
          data_type: 'text',
        },
        {
          uid: 'description',
          data_type: 'text',
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.size).to.equal(0);
      expect(dependencies.extensions.size).to.equal(0);
      expect(dependencies.taxonomies.size).to.equal(0);
    });

    it('should handle taxonomies without taxonomy_uid gracefully', () => {
      const schema = [
        {
          uid: 'categories',
          data_type: 'taxonomy',
          taxonomies: [
            { name: 'Category 1' }, // Missing taxonomy_uid
            { taxonomy_uid: 'valid_taxonomy' },
          ],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.taxonomies.has('valid_taxonomy')).to.be.true;
      expect(dependencies.taxonomies.size).to.equal(1);
    });

    it('should handle mixed dependency types in single schema', () => {
      const schema = [
        {
          uid: 'seo',
          data_type: 'global_field',
          reference_to: 'seo_global',
        },
        {
          uid: 'rich_text',
          data_type: 'text',
          extension_uid: 'editor_ext',
        },
        {
          uid: 'categories',
          data_type: 'taxonomy',
          taxonomies: [{ taxonomy_uid: 'categories_tax' }],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('seo_global')).to.be.true;
      expect(dependencies.extensions.has('editor_ext')).to.be.true;
      expect(dependencies.taxonomies.has('categories_tax')).to.be.true;
      expect(dependencies.globalFields.size).to.equal(1);
      expect(dependencies.extensions.size).to.equal(1);
      expect(dependencies.taxonomies.size).to.equal(1);
    });

    it('should handle empty schema arrays', () => {
      const schema: any[] = [];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.size).to.equal(0);
      expect(dependencies.extensions.size).to.equal(0);
      expect(dependencies.taxonomies.size).to.equal(0);
    });
  });
});
