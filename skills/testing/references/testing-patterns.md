# Testing Patterns

Testing best practices and TDD workflow for **`@contentstack/cli-cm-export-query`**.

## TDD workflow

**RED → GREEN → REFACTOR** for behavior changes. Pure refactors / docs-only may skip new tests when behavior is unchanged.

## Test Structure Standards

### Basic Test Template
```typescript
describe('[ComponentName]', () => {
  beforeEach(() => {
    // Setup mocks and test data
    sinon.stub(ExternalService.prototype, 'method').resolves(mockData);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should [expected behavior] when [condition]', () => {
    // Arrange
    const input = { /* test data */ };
    
    // Act
    const result = component.method(input);
    
    // Assert
    expect(result).to.equal(expectedOutput);
  });
});
```

### Command testing example
```typescript
describe('ExportQueryCommand', () => {
  beforeEach(() => {
    sinon.stub(ContentstackClient.prototype, 'stack').returns(mockStack);
  });

  it('should run export when query and auth are valid', async () => {
    // Stub parse, setupQueryExportConfig, QueryExporter.prototype.execute, etc.
  });
});
```

## Key Testing Rules

### Coverage
- **~80%** (lines, branches, functions) is **aspirational**, not a hard gate
- Test both success and failure paths
- Include edge cases and error scenarios

### Mocking Standards
- **Use sinon** for API responses and external dependencies
- **Never make real API calls** in tests
- **Mock at module boundaries** (SDK, `fsUtil`), not irrelevant internals
- Restore mocks in `afterEach()` to prevent test pollution

### Test Patterns
- Use descriptive test names: "should [behavior] when [condition]"
- Keep test setup minimal and focused
- Prefer synchronous patterns when possible
- Group related tests in `describe` blocks

## Common Mock Patterns

### API Mocking
```typescript
// Mock Contentstack API
sinon.stub(ContentstackClient.prototype, 'fetch').resolves(mockData);

// Mock with specific responses
sinon.stub(client, 'getEntry')
  .withArgs('entry1').resolves(mockEntry1)
  .withArgs('entry2').resolves(mockEntry2);
```

### Service Mocking
```typescript
// Mock rate limiter
sinon.stub(RateLimiter.prototype, 'wait').resolves();

// Mock file operations
sinon.stub(fsUtil, 'writeFile').returns(true);
sinon.stub(fsUtil, 'readFile').resolves(JSON.stringify(mockData));
```

### Error Simulation
```typescript
// Mock API errors
const apiError = new Error('API Error');
apiError.status = 500;
sinon.stub(client, 'fetch').rejects(apiError);

// Mock rate limiting
const rateLimitError = new Error('Rate limited');
rateLimitError.status = 429;
sinon.stub(client, 'fetch').rejects(rateLimitError);
```

## Error Testing Patterns

### Rate Limit Handling
```typescript
it('should handle rate limit errors', () => {
  const error = new Error('Rate limited');
  error.status = 429;
  
  sinon.stub(client, 'fetch').rejects(error);
  
  expect(service.performOperation()).to.eventually.be.fulfilled;
});
```

### Validation Error Testing
```typescript
it('should throw validation error for invalid input', () => {
  const invalidInput = { /* invalid data */ };
  
  expect(() => service.validate(invalidInput))
    .to.throw('Validation failed');
});
```

### Async Error Handling
```typescript
it('should handle async operation failures', async () => {
  sinon.stub(service, 'performAsync').rejects(new Error('Operation failed'));
  
  try {
    await service.execute();
    expect.fail('Should have thrown error');
  } catch (error) {
    expect(error.message).to.include('Operation failed');
  }
});
```

## Test Organization

### File Structure
- Mirror modules under `test/unit/`: e.g. `test/unit/query-executor.test.ts`, `test/unit/query-parser-simple.test.ts`
- Use consistent naming: `[module-name].test.ts`
- Group integration tests: `test/integration/`

### Test Data Management
- Create mock data factories: `test/fixtures/mock-factory.ts`
- Use realistic test data that matches API responses
- Share common mocks across test files

### Test Configuration
```javascript
// .mocharc.json
{
  "require": ["ts-node/register"],
  "extensions": ["ts"],
  "spec": "test/**/*.test.ts",
  "timeout": 5000,
  "forbid-only": true
}
```

## Coverage and Quality

### Coverage Enforcement
```json
// package.json nyc configuration
"nyc": {
  "check-coverage": true,
  "lines": 80,
  "functions": 80,
  "branches": 80,
  "statements": 80
}
```

### Quality Checklist
- [ ] All public methods tested
- [ ] Error paths covered
- [ ] Edge cases included
- [ ] Mocks properly restored
- [ ] No real API calls
- [ ] Descriptive test names
- [ ] Minimal test setup
- [ ] Fast execution (< 5s per test)