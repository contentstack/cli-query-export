# Cursor rules

Rules give context-aware guidance for this **Contentstack query-export CLI plugin** (`@contentstack/cli-cm-export-query`).

## Rules overview

| File | Purpose |
|------|---------|
| `dev-workflow.md` | TDD, structure, validation commands (always applied) |
| `typescript.mdc` | TypeScript style and naming |
| `contentstack-cli.mdc` | Contentstack CLI utilities, export flow, API habits |
| `testing.mdc` | Mocha/Chai/Sinon and coverage |
| `oclif-commands.mdc` | Command flag and delegation patterns |

## How they attach

- **Always**: `dev-workflow.md`
- **TypeScript**: `typescript.mdc`
- **Commands** (`src/commands/**`): `oclif-commands.mdc` + `typescript.mdc`
- **Core / utils** (`src/core/**`, `src/utils/**`, `src/types/**`): `contentstack-cli.mdc` + `typescript.mdc`
- **Tests** (`test/**`): `testing.mdc` + domain rules as needed

## Chat shortcuts

You can `@`-mention rule topics (for example TypeScript or testing) depending on how your workspace maps rule names.
