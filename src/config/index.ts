import { DefaultConfig } from '../types';

const config: DefaultConfig = {
  contentVersion: 2,
  host: 'https://api.contentstack.io/v3',

  // Query-based export module configuration
  modules: {
    // Always export - general modules
    general: ['stack', 'locales', 'environments'],

    // Query target modules
    queryable: ['content-types'],

    // Conditionally export - dependent modules
    dependent: ['global-fields', 'extensions', 'taxonomies'],

    // Content modules
    content: ['entries', 'assets'],

    // Export order based on dependencies
    exportOrder: [
      'stack',
      'locales',
      'environments',
      'content-types',
      'global-fields',
      'extensions',
      'taxonomies',
      'entries',
      'assets',
    ],

    // Module-specific configuration
    stack: {
      dirName: 'stack',
      fileName: 'stack.json',
    },

    locales: {
      dirName: 'locales',
      fileName: 'locales.json',
    },

    environments: {
      dirName: 'environments',
      fileName: 'environments.json',
    },

    'content-types': {
      dirName: 'content_types',
      fileName: 'content_types.json',
      limit: 100,
    },

    'global-fields': {
      dirName: 'global_fields',
      fileName: 'globalfields.json',
    },

    extensions: {
      dirName: 'extensions',
      fileName: 'extensions.json',
    },

    taxonomies: {
      dirName: 'taxonomies',
      fileName: 'taxonomies.json',
      limit: 100,
    },

    entries: {
      dirName: 'entries',
      fileName: 'entries.json',
      limit: 100,
    },

    assets: {
      dirName: 'assets',
      fileName: 'assets.json',
      batchLimit: 20,
    },
  },

  // Query-specific settings
  queryConfig: {
    supportedModules: ['content-types'],
    maxRecursionDepth: 10,
    batchSize: 100,
    metadataFileName: '_query-meta.json',
  },

  // API endpoints
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

  // Performance settings
  fetchConcurrency: 5,
  writeConcurrency: 5,
};

export default config;
