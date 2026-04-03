# Changelog

All notable changes to the ALIVE Context System plugin are documented here.

## [2.0.0] - 2026-03-29

### The ALIVE Context System

Complete architecture overhaul. Product name: ALIVE Context System. Plugin: `alive`. Install: `claude plugin install alive@stackwalnuts`.

### Architecture
- **Kernel replaces core:** `_core/` -> `_kernel/`. Three source files: key.md, log.md, insights.md
- **Bundles replace capsules:** `_capsules/` -> `bundles/` (promoted to walnut top level). Two species: outcome and evergreen.
- **Generated projections:** now.md deleted, replaced by generated `now.json`. Tasks distributed to bundles.
- **Context manifest:** `companion.md` -> `context.manifest.yaml` -- integration manifest + marketplace listing
- **Projection tiers:** world-index.json -> now.json -> manifests -> raw. Generated on save.
- **People/ elevated** outside ALIVE framework to top-level domain
- **Subagent brief pack:** `.alive/_generated/subagent-brief.md` injected into all spawned agents

### Added
- **`alive:bundle` skill** -- create, share, graduate bundles (replaces capsule-manager)
- **`alive:system-upgrade` skill** -- upgrade from any previous version with visual plan
- **Named squirrels** -- users name their context companion (persona layer)
- **Action logging** -- proof of work in squirrel YAML
- **Plugin compatibility watch** -- detect conflicts with other plugins, suggest ALIVE-compatible patterns
- **Cross-platform support** -- python3 primary, node fallback, Unicode platform-guarded

### Changed
- **Namespace:** `walnut:*` -> `alive:*` (15 skills)
- **System folder:** `.walnut/` -> `.alive/`
- **6 rules rewritten** for v2 architecture (bundles.md replaces capsules.md)
- **14 hooks updated** for v2 paths and cross-platform safety
- **README rewritten** -- ALIVE story, two units, projections, install guide

### Walnut v1 (sunset)
- `plugins/walnut/` preserved as frozen v1. Install: `claude plugin install walnut@walnut`
- No further updates. Use `alive:system-upgrade` to migrate.

## [1.0.1-beta] -- 2026-03-12

### Added
- Capsule architecture -- self-contained units of work
- 3 new skills: mine-for-context, build-extensions, my-context-graph
- Inbox scan mode, context graph, world index generator

## [1.0.0-beta] -- 2026-03-10

### Added
- 12 skills, 6 rules, 12 hooks
- Squirrel caretaker runtime, stash mechanic, ALIVE framework
- Onboarding, statusline, templates

## [0.1.0-beta] -- 2026-02-23

Initial release.
