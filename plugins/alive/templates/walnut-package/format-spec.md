---
version: "1.0.0"
type: specification
description: ".walnut package format -- portable container for sharing walnut context between worlds"
created: 2026-03-26
---

# .walnut Package Format Specification

**Version:** 1.0.0

The `.walnut` package is the portable unit of walnut context. It lets two people exchange walnut data via any channel they already use -- email, AirDrop, Slack, USB stick. No daemon, no protocol, no infrastructure. Just a file.

This format follows BagIt RFC 8493 principles (self-describing, integrity via checksums) but is not a BagIt bag.

---

## 1. Archive Structure

A `.walnut` file is a gzip-compressed tar archive with a `manifest.yaml` at the root.

**Creation command:**

```bash
COPYFILE_DISABLE=1 tar -czf <output>.walnut -C <staging-dir> .
```

`COPYFILE_DISABLE=1` is mandatory on macOS. Without it, BSD tar includes `._*` resource fork files that pollute the archive and break checksum validation on Linux.

**Extraction command:**

```bash
mkdir -p <staging-dir> && tar -xzf <package>.walnut -C <staging-dir>
```

Always extract to a temporary staging directory first. Never extract directly into the target walnut. Validate before moving content.

---

## 2. File Extension Convention

| Extension | Meaning |
|-----------|---------|
| `.walnut` | Package (tar.gz) -- encrypted or unencrypted |

Always one file, always `.walnut`. Encryption is detected by the presence of `payload.enc` inside the archive (see Section 3).

---

## 3. Encryption

Encryption uses `openssl enc` with AES-256-CBC, PBKDF2 key derivation (600,000 iterations), and random salt. This is pre-installed on macOS and Linux -- no additional dependencies. The passphrase is collected through the session and passed via environment variable (never on disk, never visible in `ps`).

**Encrypted package structure:**

An encrypted `.walnut` file is still a tar.gz, but instead of containing content files directly, it contains:

```
manifest.yaml      <- cleartext (preview without decrypting)
payload.enc        <- openssl-encrypted inner tar.gz of the actual content
```

The manifest is always readable. The content requires the passphrase.

**Encryption (share side):**

```bash
# 1. Create inner tar.gz of content
COPYFILE_DISABLE=1 tar -czf /tmp/inner.tar.gz -C <staging-dir> --exclude='manifest.yaml' .

# 2. Encrypt with passphrase via env var
WALNUT_PASSPHRASE="<passphrase>" openssl enc -aes-256-cbc -salt -pbkdf2 -iter 600000 \
  -in /tmp/inner.tar.gz -out <staging-dir>/payload.enc -pass env:WALNUT_PASSPHRASE

# 3. Create outer tar.gz (manifest.yaml + payload.enc)
COPYFILE_DISABLE=1 tar -czf <output>.walnut -C <staging-dir> manifest.yaml payload.enc
```

**Decryption (receive side):**

```bash
# 1. Extract outer tar.gz (gets manifest.yaml + payload.enc)
tar -xzf <package>.walnut -C <staging-dir>

# 2. Decrypt payload
WALNUT_PASSPHRASE="<passphrase>" openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in <staging-dir>/payload.enc -out /tmp/inner.tar.gz -pass env:WALNUT_PASSPHRASE

# 3. Extract inner content
tar -xzf /tmp/inner.tar.gz -C <staging-dir>
```

**Detection:** After extracting the outer archive, check for `payload.enc`. If present, the package is encrypted. If absent, content files are directly available.

**Passphrase handling:** MUST be passed via `env:WALNUT_PASSPHRASE` (set for one command only). Never as a CLI argument. Never written to disk.

---

## 4. Naming Convention

**Package filename pattern:**

```
<walnut-name>-<scope>-<YYYY-MM-DD>[-<n>].walnut
```

`<walnut-name>` uses the walnut's filesystem directory name, which is always lowercase kebab-case (`[a-z0-9-]+`). This matches the existing walnut naming convention.

Examples:

| Scope | Filename |
|-------|----------|
| Full | `nova-station-full-2026-03-26.walnut` |
| Capsule | `nova-station-capsule-2026-03-26.walnut` |
| Snapshot | `nova-station-snapshot-2026-03-26.walnut` |

If multiple packages of the same scope are created on the same day, append a sequence number: `nova-station-capsule-2026-03-26-2.walnut`.

---

## 5. Scope Levels

Three scopes define what goes into the package. Each is a strict subset of the walnut's `_core/` directory.

### 5.1 Full

Everything under `_core/` except excluded items. Used for handing off a walnut to someone who will continue the work.

**Rule:** Include all files and directories under `_core/` that are not explicitly excluded below.

**Directory layout inside archive (schematic):**

```
manifest.yaml
_core/
  key.md
  now.md
  log.md
  insights.md
  tasks.md
  _capsules/                  (if present)
    <all capsule directories>
  _working/                   (if present)
    <all working files>
  _references/                (if present)
    <all companions and raw files>
```

**Excluded from full scope:**
- `_core/_squirrels/` -- ephemeral, machine-specific session entries. No value to recipient.
- `_core/_index.yaml` -- derived ambient context file, regenerated locally.
- OS artifacts: `.DS_Store`, `Thumbs.db`, `desktop.ini`.
- AppleDouble/resource fork files: `._*` (prevented via `COPYFILE_DISABLE=1`).

**Import behaviour:** Always creates a new walnut. The receiver is asked which ALIVE domain to place it in (`02_Life/`, `04_Ventures/`, `05_Experiments/`).

### 5.2 Capsule

One or more capsules plus the parent walnut's `key.md` for context. Used for sharing specific work units -- a draft, a research capsule, a proposal.

**Directory layout inside archive:**

```
manifest.yaml
_core/
  key.md
  _capsules/
    <capsule-name>/
      companion.md
      raw/
        <raw files>
      <version files>
    <another-capsule>/
      ...
```

Multiple capsules are allowed in one package. The manifest's `files:` array lists every file across all included capsules.

**Immutability:** Capsule version files (e.g. `v0.1.md`, `v0.2.md`) are immutable after creation and MUST be exported byte-for-byte. Export-time stripping applies only to capsule companion frontmatter, never to version files.

**What gets stripped on export:**
- `active_sessions:` key in capsule companions -- remove the key entirely (not just emptied). Ephemeral session data is meaningless to the recipient.

**What gets preserved:**
- `sensitivity:` and `pii:` fields -- MUST be preserved. The receiver MUST surface these prominently on import and SHOULD require explicit user confirmation before importing content marked `sensitivity: restricted` or `pii: true`.
- `shared:` history -- provenance of who else has seen this capsule.
- `sources:` and `linked_capsules:` -- preserved as-is even if they reference inaccessible content. They're historical metadata.

**Import behaviour:** Into an existing walnut. Per-file keep/drop confirmation via bordered blocks. Default all capsules to one target walnut, with option to override per capsule.

### 5.3 Snapshot

Read-only status briefing. Used for stakeholder updates -- "here's where we are."

**Directory layout inside archive:**

```
manifest.yaml
_core/
  key.md
  now.md
  insights.md
```

No log, no tasks, no capsules, no working files. The recipient sees identity, current state, and domain knowledge. Nothing actionable, nothing mutable.

**Import behaviour:** Read-only preview. The receiver can view the content but it does not create or modify any walnut. Optionally, the content can be captured as a reference in an existing walnut.

---

## 6. Manifest

Every package contains a `manifest.yaml` at the archive root. See the companion `manifest.yaml` template for the full schema.

**Required fields:**

| Field | Type | Description |
|-------|------|-------------|
| `format_version` | string (semver) | Package format version. Currently `"1.0.0"`. |
| `source` | object | Provenance: walnut name, session_id, engine, plugin_version. |
| `scope` | enum | `full`, `capsule`, or `snapshot`. |
| `created` | string (ISO 8601) | When the package was created. |
| `encrypted` | boolean | `true` if the package contains `payload.enc` (openssl-encrypted content), `false` if content is directly accessible. |
| `description` | string | One-line human-readable description. Auto-generated from `key.md` goal (or capsule goal for capsule scope). |
| `files` | array | Every file in the archive with `path`, `sha256`, and `size`. |

**Optional fields:**

| Field | Type | Description |
|-------|------|-------------|
| `note` | string | Personal message from sender. Shown in bordered block on import. |
| `capsules` | array of strings | Capsule names included (capsule scope only). |

**Integrity (BagIt-inspired):** The `files` array serves the same role as BagIt's `manifest-sha256.txt`. Every file in the archive (except `manifest.yaml` itself) has a SHA-256 checksum entry. On import, the receiver validates every checksum before proceeding.

---

## 7. Encrypted Package Preview

For encrypted packages, `manifest.yaml` is always cleartext inside the outer archive. This lets the receiver preview the source, scope, note, and description before entering a passphrase. The `files:` array in the manifest lists the content files inside `payload.enc` -- their checksums are validated after decryption, not before.

No sidecar files. No separate metadata. One `.walnut` file contains everything.

---

## 8. Export Stripping Rules

Content that is stripped or transformed on export:

| Content | Action | Reason |
|---------|--------|--------|
| `_core/_squirrels/` | Excluded entirely | Ephemeral, machine-specific session data |
| `_core/_index.yaml` | Excluded | Derived ambient context, regenerated locally |
| `active_sessions:` in capsule companions | Remove key entirely | Ephemeral session data, meaningless to recipient |
| `.DS_Store`, `Thumbs.db`, `desktop.ini` | Excluded | OS artifacts |

Content that is **preserved** (even if it seems ephemeral):

| Content | Reason |
|---------|--------|
| `sensitivity: restricted` / `pii: true` | Receiver MUST surface these and SHOULD require explicit confirmation |
| `shared:` history | Provenance chain |
| `sources:` with cross-references | Historical metadata, even if inaccessible |
| `@session_id` in tasks | Transformed on *import* (not export) to `@[source-walnut]` |
| `squirrels:` array in companions | Shows which sessions contributed |

---

## 9. Import Safety

The receive skill enforces these safety checks before writing any content:

1. **Staging extraction** -- extract to a temporary directory, never directly into a walnut.
2. **Path traversal protection** -- reject any archive entry containing `..`, absolute paths, or symlinks pointing outside the staging directory.
3. **Manifest validation** -- `format_version` must be present and parseable. Major version must match the installed plugin's supported major version.
4. **Plugin version check** -- `source.plugin_version` major version must match the installed plugin major version. Block on mismatch with a clear message.
5. **Checksum validation** -- every file listed in `manifest.files` must match its `sha256` checksum. Any mismatch aborts the import.
6. **File count validation** -- every file in the extracted archive (except `manifest.yaml`) must have a corresponding entry in `manifest.files`. Unlisted files are flagged and excluded.

---

## 10. Format Versioning

Follows [Semantic Versioning 2.0.0](https://semver.org/):

- **Major** bump: any breaking change to manifest schema OR archive structure. Packages from a different major version cannot be imported without a migration tool.
- **Minor** bump: backwards-compatible additions (new optional manifest fields, new optional scope types).
- **Patch** bump: documentation clarifications, no schema changes.

The receiver checks `format_version` against its supported range. Current policy: block on major version mismatch, warn on minor version ahead.

---

## 11. Complete Archive Examples

### Full scope

```
nova-station-full-2026-03-26.walnut (tar.gz)
  manifest.yaml
  _core/
    key.md
    now.md
    log.md
    insights.md
    tasks.md
    _capsules/
      shielding-review/
        companion.md
        shielding-review-draft-01.md
        shielding-review-draft-02.md
        raw/
          vendor-specs.pdf
    _working/                               (if present)
      launch-checklist-v0.2.md
    _references/                            (if present)
      transcripts/
        2026-02-23-kai-shielding-review.md
        raw/
          2026-02-23-kai-shielding-review.mp3
```

### Capsule scope

```
nova-station-capsule-2026-03-26.walnut (tar.gz)
  manifest.yaml
  _core/
    key.md
    _capsules/
      shielding-review/
        companion.md
        shielding-review-draft-02.md
        raw/
          vendor-specs.pdf
```

### Snapshot scope

```
nova-station-snapshot-2026-03-26.walnut (tar.gz)
  manifest.yaml
  _core/
    key.md
    now.md
    insights.md
```
