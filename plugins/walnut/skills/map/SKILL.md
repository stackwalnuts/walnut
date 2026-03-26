---
description: "Render an interactive map of your world. Generates the world index from all walnut and capsule frontmatter, then produces a force-directed graph showing connections between walnuts, people, capsules, and tags. Opens in the browser."
user-invocable: true
---

# Map

Visual overview of the entire ALIVE world — connections, clusters, health.

Not a list (that's the tree in walnut:world). Not a search (that's walnut:find). Map is spatial — it shows how everything connects and where the energy is.

---

## What It Does

### 1. Generate the World Index

Run `.walnut/scripts/generate-index.py` to walk all walnuts and collect frontmatter. If the script doesn't exist in the world yet, copy it from the plugin (`scripts/generate-index.py`) or inline the logic.

```bash
python3 .walnut/scripts/generate-index.py
```

The script walks all directories for `key.md` files, handling both `_core/key.md` (new structure) and root-level `key.md` (flat/legacy structure). It deduplicates entries and skips template walnuts.

**Collected data per walnut:**
- Name, type, goal, phase, rhythm, tags
- People (from `key.md` `people:` field — multi-line list)
- Links (from `key.md` `links:` field — wikilink extraction)
- Parent (from `key.md` `parent:` field)
- Capsules (from `_capsules/*/companion.md` frontmatter — name, status, goal)
- Last updated (from `now.md` `updated:` field)

**Outputs:**
- `.walnut/_index.yaml` — human-readable world index
- `.walnut/_index.json` — machine-readable for graph consumption

### 2. Render the Graph

Run `.walnut/scripts/generate-graph.py` to read the JSON index and generate an interactive D3.js graph.

```bash
python3 .walnut/scripts/generate-graph.py
```

The graph is written to `.walnut/context-graph.html` — a self-contained HTML file with embedded data, D3.js from CDN, and custom fonts from Fontshare/Google Fonts.

**Theme:** Walnut branded. Light mode default (cream #FAF8F5, orange primary #F97316). Dark mode toggle (forest green #0A1F0D, copper #B87333 accents). Custom fonts: Array (display), Khand (headings), Inter (body).

**Nodes:**
- Walnuts (primary nodes — sized by capsule count and recency)
- People (toggle — shown for people who connect 2+ walnuts)
- Capsules (expandable — click a walnut to show its capsules as orbiting nodes)
- Central worldbuilder node connecting top-level walnuts
- Inputs buffer node showing unrouted count

**Edges:**
- `links:` field connections between walnuts
- `parent:` → child relationships (dashed)
- Person → walnut connections (dotted, when people shown)
- Capsule → parent walnut (when expanded)

**Color by ALIVE domain:**
- Life = blue
- Ventures = orange
- Experiments = green
- Archive = warm gray
- People = purple
- Inputs = red

Colors adapt per theme (lighter in dark mode for visibility).

**Size by activity:**
- 15+ capsules = largest (20px)
- 5+ capsules = large (15px)
- Updated in last 2 days = medium-large (12px)
- Updated in last week = medium (9px)
- Stale = small (5px)

**Health signals visible:**
- Active (recent) = full opacity, glow on today's updates
- Quiet (1-2 weeks) = reduced opacity
- Waiting (2+ weeks) = dim, small
- Capsule-heavy walnuts get outer glow rings

### 3. Open in Browser

```
╭─ 🐿️ map generated
│
│  58 walnuts, 78 people, 41 capsules
│  60 nodes, 36 links, 11 people connectors
│
│  ▸ Opening in browser...
╰─
```

---

## Graph Features

### Interactive Controls

- **Hover node** → tooltip with goal, phase, capsule count, next action
- **Hover node** → highlight all connected nodes and edges, dim everything else
- **Click walnut** → expand capsules as orbiting nodes + open details panel
- **Click node** → pin details panel (right sidebar) with full context
- **Drag** → reposition nodes (physics simulation)
- **Zoom + pan** → navigate large worlds
- **Hover edge** → show connection type label (linked / parent → child / person name)
- **Esc** → close details panel

### Details Panel

Click any node to open a pinned side panel showing:
- Name, domain badge, phase badge
- Goal description
- Metadata (rhythm, last updated, days since, session count)
- Next action (highlighted)
- Capsule list with status badges (draft/prototype/published/done)
- Active capsule highlighted in primary color
- People list
- Tags

### Search

- **`/` hotkey** → focus search box
- Searches walnut names, goals, tags, and people
- Matching nodes highlighted, everything else dims
- **Esc** → clear search

### Theme Toggle

- Light mode default (Walnut cream branding)
- Dark mode toggle (forest green + copper)
- Theme persists via localStorage
- Sun/moon toggle in header

### Controls

- **reset view** → zoom to fit
- **show people** → toggle people connector nodes
- **labels on/off** → toggle node labels
- **show archive** → toggle archived walnuts
- **cluster** → group nodes by ALIVE domain with background labels

### Capsule Expansion

Click any walnut with capsules to expand them as orbiting nodes:
- Capsule nodes sized by active status (active capsule = larger)
- Capsule color by status: draft (gray), prototype (amber), done (green)
- Active capsule has a highlighted stroke
- Click the walnut again to collapse
- Capsule details shown in the details panel

---

## Files

| File | Purpose |
|------|---------|
| `.walnut/_index.yaml` | Generated world index — human-readable, all frontmatter |
| `.walnut/_index.json` | Generated world index — JSON for graph consumption |
| `.walnut/context-graph.html` | Interactive D3.js graph — self-contained, Walnut branded |
| `.walnut/scripts/generate-index.py` | Index generator (walks tree, reads frontmatter, outputs YAML + JSON) |
| `.walnut/scripts/generate-graph.py` | Graph generator (reads JSON index, outputs branded HTML with D3.js) |

**Plugin source:** Both scripts ship with the plugin at `scripts/generate-index.py` and `scripts/generate-graph.py`. On first `walnut:map` invocation, copy them to `.walnut/scripts/` if not already present.

---

## Regeneration

The index and graph should be regenerated:
- On every `walnut:map` invocation (always fresh)
- Suggested after `walnut:save` when structural changes occurred (new walnut, new capsule, new person)
- After `walnut:tidy` resolves issues that affect the graph (broken links, orphan walnuts)

```
╭─ 🐿️ world changed — regenerate map?
│  New walnut created: flux-engine
│  2 new capsules, 1 new person
│
│  ▸ Regenerate / Skip
╰─
```

---

## What Map Is NOT

- Not `walnut:world` — world is the operational dashboard (what to work on). Map is the spatial view (how things connect).
- Not `walnut:find` — find retrieves specific content. Map shows the topology.
- Not `walnut:tidy` — tidy fixes structural issues. Map visualizes the structure.

World answers "what should I do?" Map answers "what does my world look like?"
