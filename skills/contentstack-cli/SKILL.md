---
name: contentstack-cli
description: Contentstack CLI query-export plugin — OCLIF command, QueryExporter, cli-utilities, and export behavior. Use for commands, core export logic, utils, and API usage in this repo.
---

# Contentstack CLI — query export

## Quick reference

- **[Contentstack patterns](references/contentstack-patterns.md)** — Command shape, export pipeline, API habits
- **[Framework patterns](../framework/references/framework-patterns.md)** — Config, logging, errors

## This package

- **Command:** `ExportQueryCommand` in `src/commands/cm/stacks/export-query.ts` extends **`Command`** from **`@contentstack/cli-command`**.
- **Orchestration:** **`QueryExporter`** and **`ModuleExporter`** in **`src/core/`**.
- **Helpers:** Query parsing, config, dependencies, assets, branches under **`src/utils/`**.
- **Integration:** **`@contentstack/cli-cm-export`**, **`@contentstack/cli-utilities`**, **`@oclif/core`** (transitive / manifest).

## Practices

- Authenticate and build the management client via **`@contentstack/cli-utilities`**; never log secrets.
- Keep **`run()`** thin; delegate to **`QueryExporter`** and existing utils.
- Respect rate limits and handle **429** / transient errors when adding API calls.
- Tests: mock SDK and file I/O; no real stack access in unit tests.

## Usage

Use this skill when changing export behavior, flags, query handling, or Contentstack API usage. Open **references/contentstack-patterns.md** for longer examples.
