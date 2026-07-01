# Control Tower Documentation

This folder is organized to help engineering, product, and operations teams understand the current platform quickly.

## Start Here

- **Current Technical Guide (recommended):** [TECHNICAL_SYSTEM_GUIDE.md](./TECHNICAL_SYSTEM_GUIDE.md)
- **Architecture overview:** [01-architecture](./01-architecture/)
- **Module docs:** [02-modules](./02-modules/)
- **Integrations:** [05-integrations](./05-integrations/)
- **AI features:** [06-ai-features](./06-ai-features/)
- **Edge functions:** [08-edge-functions](./08-edge-functions/)

## Documentation Structure

- `00-getting-started/` setup and environment onboarding
- `01-architecture/` system and schema references
- `02-modules/` module-level product/technical documentation
- `03-development/` contributor and release workflows
- `04-deployment/` deployment and production checklists
- `05-integrations/` provider setup and data flows
- `06-ai-features/` AI and agent-specific docs
- `07-admin/` admin operating docs
- `08-edge-functions/` backend serverless docs
- `archive/` historical/retired documentation

## Cleanup Completed

To reduce noise and improve discoverability, obsolete operational logs and duplicated import-source docs were removed from active docs in this update:

- `docs/daily/*`
- `docs/original/*`
- stale one-off reports that duplicated current docs

If historical detail is still needed, recreate focused records under `docs/archive/` with dates and clear ownership.
