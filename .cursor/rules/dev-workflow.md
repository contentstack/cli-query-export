---
description: "Core development workflow and TDD patterns - always applied"
globs: ["**/*.ts", "**/*.js", "**/*.json"]
alwaysApply: true
---

# Development Workflow

## Quick Reference

For detailed patterns, see project skills:

- `@skills/testing` — Testing and TDD
- `@skills/contentstack-cli` — Export command, utilities, and API usage
- `@skills/framework` — Config, logging, and shared patterns
- `@skills/code-review` — PR review checklist

## TDD workflow (recommended)

For **new behavior or bug fixes**, prefer working in three steps:

1. **RED** → Write a failing test (or extend an existing one)
2. **GREEN** → Minimal code to pass
3. **REFACTOR** → Clean up while tests stay green

**Exceptions (no new test required when behavior is unchanged):** pure refactors, documentation-only edits, comments/config-only tweaks, trivial typos.

## Guidelines

- **Coverage:** aim high; **~80%** (lines/branches/functions) is an **aspirational target**, not a CI gate in this repo
- **TypeScript** — explicit return types where practical; avoid `any`
- **NO test.skip or .only** in commits

## File structure (this repo)

- **Command**: `src/commands/cm/stacks/export-query.ts`
- **Core**: `src/core/` — `QueryExporter`, `ModuleExporter`
- **Utils**: `src/utils/` — query parsing, config, dependencies, assets, branches, file helpers
- **Types**: `src/types/index.ts`
- **Config**: `src/config/` (copied to `lib/` on build)
- **Messages**: `messages/index.json`
- **Tests**: `test/unit/*.test.ts` (grouped by module under test)

## Naming conventions

- Files: `kebab-case.ts` / `kebab-case.test.ts`
- Classes: `PascalCase`
- Functions: `camelCase`
- Tests: `should [behavior] when [condition]`

## Before coding

1. Read relevant `@skills/*` references
2. For behavior changes: prefer a failing test first, then implement
3. Refactor and run tests

## Validation commands

- `npm run lint` — ESLint on `src/**/*.ts`
- `npm run test` — All tests with nyc
- `npm run test:report` — LCOV coverage report
- `npm run test:unit` — Unit tests only
- `npm run format` — ESLint `--fix`

## Commit suggestions

- Conventional commits are helpful but optional: `feat(scope): description`
- Tests passing before merge
- No lint errors
- No stray `console.log` / `debugger`
