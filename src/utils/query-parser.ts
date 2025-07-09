import * as fs from 'fs';
import { CLIError } from '@contentstack/cli-utilities';
import { ExportQueryConfig } from '../types';

export class QueryParser {
  private config: ExportQueryConfig;

  constructor(config: ExportQueryConfig) {
    this.config = config;
  }

  async parse(queryInput: string): Promise<any> {
    let query: any;

    // Check if it's a file path
    if (queryInput.endsWith('.json') && fs.existsSync(queryInput)) {
      query = this.parseFromFile(queryInput);
    } else {
      query = this.parseFromString(queryInput);
    }

    this.validate(query);
    return query;
  }

  private parseFromFile(filePath: string): any {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new CLIError(`Failed to parse query file: ${error.message}`);
    }
  }

  private parseFromString(queryString: string): any {
    try {
      return JSON.parse(queryString);
    } catch (error) {
      throw new CLIError(`Invalid JSON query: ${error.message}`);
    }
  }

  private validate(query: any): void {
    if (!query || typeof query !== 'object') {
      throw new CLIError('Query must be a valid JSON object');
    }

    if (!query.modules || typeof query.modules !== 'object') {
      throw new CLIError('Query must contain a "modules" object');
    }

    const modules = Object.keys(query.modules);
    if (modules.length === 0) {
      throw new CLIError('Query must contain at least one module');
    }

    // Validate supported modules
    const queryableModules = this.config.modules.capabilities.queryable;
    for (const module of modules) {
      if (!queryableModules.includes(module as any)) {
        throw new CLIError(`Module "${module}" is not queryable. Supported modules: ${queryableModules.join(', ')}`);
      }
    }

    // Validate query structure for each module
    for (const [moduleName, moduleQuery] of Object.entries(query.modules)) {
      this.validateModuleQuery(moduleName, moduleQuery);
    }

    // Validate query depth
    this.validateQueryDepth(query, 0);
  }

  private validateModuleQuery(moduleName: string, moduleQuery: any): void {
    if (!moduleQuery || typeof moduleQuery !== 'object') {
      throw new CLIError(`Query for module "${moduleName}" must be an object`);
    }

    const moduleConfig = this.config.modules.definitions[moduleName as any];
    if (moduleConfig?.queryConfig) {
      this.validateQueryOperators(moduleQuery, moduleConfig.queryConfig.supportedOperators);
      this.validateQueryFields(moduleQuery, moduleConfig.queryConfig.supportedFields, moduleName);
    }
  }

  private validateQueryOperators(queryObj: any, supportedOperators: string[]): void {
    for (const [key, value] of Object.entries(queryObj)) {
      if (key.startsWith('$')) {
        if (!supportedOperators.includes(key)) {
          throw new CLIError(`Invalid query operator: ${key}. Supported operators: ${supportedOperators.join(', ')}`);
        }
      }

      if (typeof value === 'object' && value !== null) {
        this.validateQueryOperators(value, supportedOperators);
      }
    }
  }

  private validateQueryFields(queryObj: any, supportedFields: string[], moduleName: string): void {
    for (const [key, value] of Object.entries(queryObj)) {
      if (!key.startsWith('$') && !supportedFields.includes(key)) {
        throw new CLIError(
          `Invalid query field "${key}" for module "${moduleName}". Supported fields: ${supportedFields.join(', ')}`,
        );
      }

      if (typeof value === 'object' && value !== null && !key.startsWith('$')) {
        // Field-level operators are allowed
        this.validateQueryOperators(value, this.config.queryConfig.defaultOperators);
      }
    }
  }

  private validateQueryDepth(obj: any, depth: number): void {
    if (depth > this.config.queryConfig.validation.maxQueryDepth) {
      throw new CLIError(
        `Query depth exceeds maximum allowed depth of ${this.config.queryConfig.validation.maxQueryDepth}`,
      );
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (typeof value === 'object') {
          this.validateQueryDepth(value, depth + 1);
        }
        if (Array.isArray(value) && value.length > this.config.queryConfig.validation.maxArraySize) {
          throw new CLIError(
            `Array size exceeds maximum allowed size of ${this.config.queryConfig.validation.maxArraySize}`,
          );
        }
      }
    }
  }
}
