import * as path from 'path';
import { QueryExportConfig } from '../types';
import { log } from './logger';

export class ReferencedContentTypesHandler {
  private exportQueryConfig: QueryExportConfig;

  constructor(exportQueryConfig: QueryExportConfig) {
    this.exportQueryConfig = exportQueryConfig;
  }

  /**
   * Extract referenced content types from a batch of content types
   * This method only processes the given batch, doesn't orchestrate the entire process
   */
  async extractReferencedContentTypes(contentTypeBatch: any[]): Promise<string[]> {
    const allReferencedTypes: Set<string> = new Set();

    log(this.exportQueryConfig, `Extracting references from ${contentTypeBatch.length} content types`, 'info');

    for (const contentType of contentTypeBatch) {
      if (contentType.schema) {
        const referencedTypes = this.getReferencedContentTypes(contentType.schema);
        referencedTypes.forEach((type) => allReferencedTypes.add(type));
      }
    }

    const result = Array.from(allReferencedTypes);
    log(this.exportQueryConfig, `Found ${result.length} referenced content types`, 'info');
    return result;
  }

  /**
   * Filter content types to get only newly fetched ones based on UIDs
   */
  filterNewlyFetchedContentTypes(allContentTypes: any[], previousUIDs: Set<string>): any[] {
    return allContentTypes.filter((ct) => !previousUIDs.has(ct.uid));
  }

  /**
   * Extract referenced content types from a content type schema
   * Moved from content-type-helper.ts for better encapsulation
   */
  private getReferencedContentTypes(schema: any): string[] {
    const referencedTypes: Set<string> = new Set();

    const traverseSchema = (schemaArray: any[]) => {
      for (const field of schemaArray) {
        if (field.data_type === 'group' || field.data_type === 'global_field') {
          // Recursively traverse group and global field schemas
          traverseSchema(field.schema);
        } else if (field.data_type === 'blocks') {
          // Traverse each block's schema
          for (const blockKey in field.blocks) {
            traverseSchema(field.blocks[blockKey].schema);
          }
        } else if (field.data_type === 'reference' && field.reference_to) {
          // Add reference field targets
          field.reference_to.forEach((ref: string) => {
            if (ref !== 'sys_assets') {
              // Exclude system assets
              referencedTypes.add(ref);
            }
          });
        } else if (
          // Handle JSON RTE with embedded entries
          field.data_type === 'json' &&
          field.field_metadata?.rich_text_type &&
          field.field_metadata?.embed_entry &&
          field.reference_to
        ) {
          field.reference_to.forEach((ref: string) => {
            if (ref !== 'sys_assets') {
              referencedTypes.add(ref);
            }
          });
        } else if (
          // Handle Text RTE with embedded entries
          field.data_type === 'text' &&
          field.field_metadata?.rich_text_type &&
          field.field_metadata?.embed_entry &&
          field.reference_to
        ) {
          field.reference_to.forEach((ref: string) => {
            if (ref !== 'sys_assets') {
              referencedTypes.add(ref);
            }
          });
        }
      }
    };

    traverseSchema(schema);
    return Array.from(referencedTypes);
  }
}
