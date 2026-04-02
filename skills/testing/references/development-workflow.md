# Development Workflow

Core development rules and Test-Driven Development (TDD) workflow for **`@contentstack/cli-cm-export-query`**.

## TDD workflow (recommended)

For **new behavior or bug fixes**, prefer:

1. **RED** → Failing test (or extended test)
2. **GREEN** → Minimal code to pass
3. **REFACTOR** → Improve while tests stay green

**Exceptions:** pure refactors, documentation-only edits, and trivial non-behavior changes may skip new tests.

## Guidelines

- Prefer **clear tests** over async-heavy setup when you can
- **NO test.skip or .only** in commits
- **~80% coverage** (lines, branches, functions) is **aspirational**, not a CI gate
- **TypeScript** — explicit return types where practical; avoid `any`

## File structure (this repo)

- **Commands**: `src/commands/cm/stacks/`
- **Core**: `src/core/` (`QueryExporter`, `ModuleExporter`, …)
- **Utils**: `src/utils/`
- **Tests**: `test/unit/` — `*.test.ts` per module (e.g. `query-executor.test.ts`)

## Naming conventions

- **Files**: `kebab-case.ts` / `kebab-case.test.ts`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Test descriptions**: "should [behavior] when [condition]"

## Code quality standards

### TypeScript
- Explicit return types for all functions
- No `any` type usage
- Strict null checks enabled
- No unused variables or imports

### Error handling
- Use custom error classes where the codebase already does
- Include error context and cause
- Never swallow errors silently

### Import organization
1. Node.js built-ins
2. External libraries
3. Internal modules (relative imports last)

## Testing

### Coverage
- Aim high; **~80%** is a guideline
- Test success and failure paths for behavior you touch
- Mock external dependencies (SDK, `fsUtil`, etc.)

### Test structure
```typescript
describe('[ComponentName]', () => {
  beforeEach(() => {
    sinon.stub(ExternalService.prototype, 'method').resolves(mockData);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should [expected behavior] when [condition]', () => {
    const input = { /* test data */ };
    const result = component.method(input);
    expect(result).to.equal(expectedOutput);
  });
});
```

### Mocking standards
- Use sinon for API response mocking
- Never make real API calls in tests
- Mock at module boundaries (SDK, `fsUtil`, etc.), not irrelevant internals

## Commit suggestions

- Conventional commits are optional: `feat(scope): description`
- Include tests when you change behavior
- Run lint and tests before pushing
- No debugging code (`console.log`, `debugger`) left in

## Development process

1. **Understand** → Read relevant patterns before coding
2. **Plan** → Break down into testable units
3. **Test first** → When adding behavior, prefer failing test then implementation
4. **Validate** → `npm run lint`, `npm run test`, `npm run test:report` if you need LCOV
5. **Review** → Self-review against the code review checklist
