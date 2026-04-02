---
name: testing
description: Mocha/Chai/Sinon testing and TDD for @contentstack/cli-cm-export-query. Use when writing or debugging tests in test/unit/ or adjusting coverage.
---

# Testing Patterns

## Quick Reference

For comprehensive testing guidance, see:
- **[Testing Patterns](./references/testing-patterns.md)** - Complete testing best practices and TDD workflow
- **[Development Workflow](./references/development-workflow.md)** - TDD process and validation requirements

## TDD workflow summary

**RED → GREEN → REFACTOR** for behavior changes; pure refactors / docs-only may skip new tests when behavior is unchanged.

## Key testing rules

- **~80% coverage** (lines, branches, functions) is **aspirational**, not a hard CI gate here
- **Use sinon** for API responses and mocking
- **Never make real API calls** in tests
- **Mock at service boundaries**, not implementation details
- **Test both success and failure paths**
- **Use descriptive test names**: "should [behavior] when [condition]"

## Quick Test Template

```typescript
describe('[ComponentName]', () => {
  beforeEach(() => {
    sinon.stub(ExternalService.prototype, 'method').resolves(mockData);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should [expected behavior] when [condition]', () => {
    // Arrange, Act, Assert
  });
});
```

## Common Mock Patterns

```typescript
// Mock Contentstack API
sinon.stub(ContentstackClient.prototype, 'fetch').resolves(mockData);

// Mock rate limiter
sinon.stub(RateLimiter.prototype, 'wait').resolves();

// Mock file operations
sinon.stub(fsUtil, 'writeFile').returns(true);
```

## Usage

Reference the universal testing patterns above for detailed test structures, mocking strategies, error testing patterns, and coverage requirements. This skill provides Cursor-specific integration while the universal docs work with any AI agent.