# Skills

Reusable agent guidance for **`@contentstack/cli-cm-export-query`** (query-based stack export). Use with any tool that supports file references.

## Quick reference

| Skill | Use when |
|-------|----------|
| **contentstack-cli** | Command, `QueryExporter`, utilities, Contentstack APIs |
| **testing** | Mocha, Chai, Sinon, TDD, coverage |
| **framework** | Config, logging, errors, shared utilities |
| **code-review** | PR / change review |

## How to reference

```
Follow @skills/contentstack-cli and @skills/testing for this change.
```

## Project context

- **Stack:** TypeScript, OCLIF (via `@contentstack/cli-command`), Contentstack CLI utilities, Mocha / Chai / Sinon, nyc
- **Layout:** `src/commands/` → `src/core/` (`QueryExporter`, `ModuleExporter`) → `src/utils/`
- **Tests:** `test/unit/**/*.test.ts`
