---
name: code-review
description: PR review checklist for this repo and similar CLI plugins. Use when reviewing changes to export-query, core, or utils.
---

# Code Review Skill

## Quick Reference

For comprehensive review guidelines, see:
- **[Code Review Checklist](./references/code-review-checklist.md)** - Complete PR review guidelines with severity levels and checklists

## Review Process

### Severity Levels
- 🔴 **Critical**: Must fix before merge (security, correctness, breaking changes)
- 🟡 **Important**: Should fix (performance, maintainability, best practices)
- 🟢 **Suggestion**: Consider improving (style, optimization, readability)

### Quick Review Categories

1. **Security** - No hardcoded secrets, input validation, secure error handling
2. **Correctness** - Logic validation, error scenarios, data integrity
3. **Architecture** - Code organization, design patterns, modularity
4. **Performance** - Efficiency, resource management, concurrency
5. **Testing** - Test coverage (aspirational targets), quality tests, sensible TDD when adding behavior
6. **Conventions** - TypeScript standards, code style, documentation

## Quick Checklist Template

```markdown
## Security Review
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Error handling secure

## Correctness Review  
- [ ] Logic correctly implemented
- [ ] Edge cases handled
- [ ] Error scenarios covered

## Architecture Review
- [ ] Proper code organization
- [ ] Design patterns followed
- [ ] Good modularity

## Performance Review
- [ ] Efficient implementation
- [ ] Resource management
- [ ] Appropriate concurrency

## Testing Review
- [ ] Adequate tests for behavior changed
- [ ] Quality tests
- [ ] Test-first used where practical for new behavior

## Code Conventions
- [ ] TypeScript standards
- [ ] Code style consistent
- [ ] Documentation adequate
```

## Usage

This skill provides Cursor-specific PR review automation. Reference the universal code review checklist above for detailed guidelines, common issues, and review best practices that work with any AI agent.