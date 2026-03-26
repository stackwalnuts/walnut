---
description: "Migrates a world from the alive plugin (pre-v1) to Walnut v1.0.0. Handles .alive/ → .walnut/ rename, resolves conflicts when both exist, and verifies system integrity post-migration."
user-invocable: false
---

# Migrate: alive → Walnut v1.0.0

This skill runs when the session-new hook detects a migration is needed, or when both `.alive/` and `.walnut/` exist and need manual resolution.

---

## Auto-Migration (hook handled)

The session-new hook automatically renames `.alive/` → `.walnut/` when:
- `.alive/` exists
- `.walnut/` does not exist

When this happens, the session message includes `MIGRATION COMPLETE`. No further action needed — just inform the user:

```
╭─ 🐿️ migrated to Walnut v1.0.0
│  .alive/ → .walnut/ (automatic)
│  All squirrel entries, preferences, and statusline preserved.
│  Skills are now walnut:* (was alive:*)
╰─
```

---

## Conflict Resolution (both exist)

When the session message includes `WARNING: Both .alive/ and .walnut/ exist`:

1. Read both directories and compare contents:
   - Check `.alive/_squirrels/` vs `.walnut/_squirrels/` — which has newer entries?
   - Check `.alive/preferences.yaml` vs `.walnut/preferences.yaml` — which is current?
   - Check `.alive/key.md` vs `.walnut/key.md` — are they different?

2. Present the situation:

```
╭─ 🐿️ migration conflict
│  Both .alive/ and .walnut/ exist in this world.
│
│  .alive/ — N squirrel entries, last: YYYY-MM-DD
│  .walnut/ — N squirrel entries, last: YYYY-MM-DD
│
│  ▸ How to resolve?
│  1. Keep .walnut/, archive .alive/ contents into it
│  2. Keep .alive/ contents, rename to .walnut/
│  3. Merge both (newest wins per file)
╰─
```

3. Execute the chosen resolution:
   - **Option 1:** Move any unique files from `.alive/` into `.walnut/`, then remove `.alive/`
   - **Option 2:** Remove `.walnut/`, rename `.alive/` → `.walnut/`
   - **Option 3:** For each file, keep the newer version. Merge `_squirrels/` (all entries are unique by session_id)

4. After resolution, verify:
   - `.walnut/_squirrels/` exists and has entries
   - `.walnut/preferences.yaml` exists (if it did before)
   - `.walnut/key.md` exists
   - `.walnut/statusline.sh` exists
   - `.alive/` no longer exists

---

## Post-Migration Checklist

After any migration path, verify:

- [ ] `.walnut/` exists with correct structure
- [ ] `.alive/` does not exist (or is archived)
- [ ] `~/.config/walnut/world-root` exists (if `~/.config/alive/world-root` did)
- [ ] Squirrel entries are intact
- [ ] Preferences are intact
- [ ] World key.md is readable

---

## What This Migration Does NOT Touch

- **Walnut data** — all `_core/` files, capsules, log entries, tasks, insights are untouched. They live in the ALIVE domain folders (01_Archive through 05_Experiments), not in `.alive/`.
- **Git history** — nothing changes in version control.
- **External integrations** — MCP servers, email, Slack sync scripts are unaffected.
