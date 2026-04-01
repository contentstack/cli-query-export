---
name: framework
description: Utilities, configuration, logging, and error patterns for @contentstack/cli-cm-export-query. Use when working in src/utils/, config, or shared helpers — align with @contentstack/cli-utilities where possible.
---

# Framework Patterns Skill

## Quick Reference

For comprehensive framework guidance, see:
- **[Framework Patterns](references/framework-patterns.md)** - Complete utilities, configuration, logging, and framework patterns

## Core Framework Components

### Configuration Management
- Centralized configuration with environment-specific overrides
- Validation of required configuration values
- Type-safe configuration interfaces

### Logging Framework
- Structured logging with different levels (debug, info, warn, error)
- Consistent log formatting and metadata
- Context-aware logging for debugging

### Error Handling Framework
- Consistent error handling with context and categorization
- Custom error classes for different error types
- Proper error propagation and logging

### Utility Classes
- Rate limiter for API throttling
- Retry strategy with exponential backoff
- Batch or chunked processing when exporting large module sets (if introduced)
- File system utilities with error handling

## Quick Patterns

### Configuration Builder
```typescript
export class ConfigBuilder {
  static build(): AppConfig {
    return {
      contentstack: {
        apiKey: process.env.CONTENTSTACK_API_KEY!,
        authToken: process.env.CONTENTSTACK_AUTH_TOKEN!
      },
      batch: {
        defaultSize: parseInt(process.env.BATCH_SIZE || '10'),
        maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '3')
      }
    };
  }
}
```

### Error Handling
```typescript
export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly category = 'validation' as const;
}
```

### Rate Limiter
```typescript
const rateLimiter = new RateLimiter(3, 100); // 3 concurrent, 100ms interval
await rateLimiter.execute(() => apiCall());
```

## Usage

This skill provides Cursor-specific framework integration. Reference the universal framework patterns above for detailed implementations of configuration, logging, error handling, utilities, and dependency injection patterns that work with any AI agent.