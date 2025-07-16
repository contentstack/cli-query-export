import * as path from 'path';
import { QueryExportConfig } from '../types';
import { fsUtil } from './index';
import { sanitizePath } from '@contentstack/cli-utilities';
import { log } from './logger';

export class ContentTypeDependenciesHandler {
  private exportQueryConfig: QueryExportConfig;

  constructor(exportQueryConfig: QueryExportConfig) {
    this.exportQueryConfig = exportQueryConfig;
  }

  extractDependencies(): {
    globalFields: Set<string>;
    extensions: Set<string>;
    taxonomies: Set<string>;
  } {
    const contentTypesFilePath = path.join(this.exportQueryConfig.exportDir, 'content_types', 'schema.json');
    const allContentTypes = fsUtil.readFile(sanitizePath(contentTypesFilePath)) as any[];

    log(this.exportQueryConfig, `Extracting dependencies from ${allContentTypes.length} content types`, 'info');

    const dependencies = {
      globalFields: new Set<string>(),
      extensions: new Set<string>(),
      taxonomies: new Set<string>(),
    };

    for (const contentType of allContentTypes) {
      if (contentType.schema) {
        this.traverseSchemaForDependencies(contentType.schema, dependencies);
      }
    }

    log(
      this.exportQueryConfig,
      `Found dependencies - Global Fields: ${dependencies.globalFields.size}, Extensions: ${dependencies.extensions.size}, Taxonomies: ${dependencies.taxonomies.size}`,
      'info',
    );

    return dependencies;
  }

  private traverseSchemaForDependencies(schema: any[], dependencies: any): void {
    for (const field of schema) {
      // Global fields
      if (field.data_type === 'global_field' && field.reference_to) {
        dependencies.globalFields.add(field.reference_to);
      }

      // Extensions
      if (field.extension_uid) {
        dependencies.extensions.add(field.extension_uid);
      }

      // Taxonomies - UPDATED LOGIC
      if (field.data_type === 'taxonomy' && field.taxonomies && Array.isArray(field.taxonomies)) {
        field.taxonomies.forEach((tax: any) => {
          if (tax.taxonomy_uid) {
            dependencies.taxonomies.add(tax.taxonomy_uid);
          }
        });
      }

      // Recursive traversal for nested structures
      if (field.data_type === 'group' && field.schema) {
        this.traverseSchemaForDependencies(field.schema, dependencies);
      }

      if (field.data_type === 'blocks' && field.blocks) {
        for (const blockKey in field.blocks) {
          if (field.blocks[blockKey].schema) {
            this.traverseSchemaForDependencies(field.blocks[blockKey].schema, dependencies);
          }
        }
      }
    }
  }
}
