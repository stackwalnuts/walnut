---
description: "Deep context extraction from source material. Creates reference capsules, builds extraction plans, tracks what's been extracted, and discovers new targets — people, subjects, patterns, connections. The archaeologist that turns raw sources into structured knowledge. Can be invoked by walnut:history for targeted session mining."
user-invocable: true
---

# Mine

Deep extraction. Turn raw sources into structured context.

Not a quick search (that's find). Not session timeline (that's history). Mine is the heavy operation — reading source material systematically, extracting everything of value, and routing it into the world.

---

## When It Fires

- The human says "mine this", "extract from these", "what's buried in here"
- `walnut:history` escalates — "these sessions look rich, want to deep-mine them?"
- The human points at a folder of transcripts, documents, or exports
- A capsule has raw sources that haven't been fully processed
- The human asks "what have I missed?" or "find everything about X in my sources"

---

## What It Does

### 1. Assess Source Material

Scan what's available. Don't read everything — just understand the landscape.

```
╭─ 🐿️ scanning sources
│
│  _core/_capsules/client-calls/raw/ — 12 transcripts (3 unprocessed)
│  _core/_capsules/research/raw/ — 8 documents (5 unprocessed)
│  .walnut/_squirrels/ — 23 sessions (8 with rich stash, 4 unmined transcripts)
│
│  Total: 43 sources, 12 unprocessed, 4 unmined sessions
╰─
```

### 2. Build Extraction Plan

Before touching any content, propose a plan. What to look for, in what order, expected yield.

```
╭─ 🐿️ extraction plan
│  Source: _core/_capsules/client-calls/raw/ (12 transcripts)
│
│  Targets:
│  - People mentioned (create/update person walnuts)
│  - Decisions made (route to walnut logs)
│  - Tasks assigned (route to walnut tasks)
│  - Domain knowledge (route to insights)
│  - Recurring themes (flag as potential capsules)
│
│  ▸ Run this plan?
│  1. Yeah, mine it
│  2. Adjust targets
│  3. Mine specific files only
╰─
```

The plan adapts to what the human needs:
- "Mine the last 3 squirrels" -> session-focused extraction
- "Mine everything about merchgirls from February" -> topic-focused, date-filtered
- "Who keeps coming up that I haven't tracked?" -> people discovery mode
- "What patterns do you see?" -> theme extraction

### 3. Extract Systematically

Process sources one at a time or in batches. For each source:

- **Read** the full content (transcript, document, export)
- **Extract** against the plan targets
- **Route** extracted items:
  - People -> stash for person walnut creation/update
  - Decisions -> stash for log routing at save
  - Tasks -> stash for task routing at save
  - Knowledge -> stash as insight candidates
  - Themes -> flag as potential new capsules
- **Update companion** -> mark the source as processed in the capsule companion frontmatter

Extraction is bounded by source type:

| Source Type | Extract |
|------------|---------|
| Transcript | Decisions, action items, people + roles, key quotes, domain knowledge, commitments, deadlines |
| Document | Key claims, data points, relevant sections, author context, links to other work |
| Session transcript | Decisions + rationale, files touched, architectural choices, dead ends, open threads |
| Export (ChatGPT, etc.) | Topics discussed, decisions made, knowledge synthesized, people referenced |
| Email thread | Commitments, deadlines, people + relationships, action items, context updates |

### 4. Track Progress

The capsule companion tracks extraction state in frontmatter:

```yaml
extraction:
  status: partial          # none | partial | complete
  last_mined: 2026-03-10
  processed:
    - path: raw/2026-02-15-call-with-jax.md
      extracted: [3 people, 2 decisions, 1 insight]
    - path: raw/2026-02-20-shielding-review.md
      extracted: [1 person, 4 decisions, 2 tasks]
  unprocessed:
    - raw/2026-03-01-vendor-followup.md
    - raw/2026-03-05-budget-review.md
```

This means the squirrel can resume mining across sessions — it knows exactly what's been done and what remains.

### 5. Discover Targets

The most valuable part. While extracting, actively watch for:

- **New people** — names that appear across multiple sources but have no person walnut. Surface them with context about who they are and how they relate.
- **Recurring subjects** — topics that keep coming up across sources. These might deserve their own capsule or even walnut.
- **Interests and tendencies** — patterns in what the human focuses on, returns to, or avoids. Not for judgment — for awareness.
- **Cross-walnut connections** — references in one walnut's sources to another walnut's domain. These are invisible links the system should know about.
- **Contradictions** — decisions in one source that conflict with decisions in another. Surface these gently.

```
╭─ 🐿️ discoveries
│
│  People without walnuts:
│   - Dr. Elara Voss (mentioned 7 times across 3 transcripts)
│   - Marcus Chen (mentioned in 2 documents, seems to be a vendor contact)
│
│  Recurring themes:
│   - "Regulatory timeline" comes up in 5 of 12 transcripts
│     -> worth a capsule?
│
│  Cross-walnut:
│   - nova-station sources reference glass-cathedral pricing 3 times
│     -> add link?
│
│  ▸ Act on these / note and move on
╰─
```

### 6. Mark Completion

When a source or batch is fully mined:

```
╭─ 🐿️ mining complete
│
│  Processed: 12 transcripts in client-calls
│  Extracted: 8 people, 14 decisions, 6 tasks, 3 insights, 2 themes
│  Stashed: 33 items ready for routing at save
│  Discoveries: 2 new people suggested, 1 capsule suggested, 1 cross-link
│
│  ▸ Run walnut:save to route everything
│  ▸ Mine another source
│  ▸ Done for now
╰─
```

---

## Mining Sessions (via walnut:history)

When `walnut:history` identifies unmined sessions — long transcripts with extensive decision-making or research — it can hand off to mine with a specific scope:

"Mine the last 3 squirrels" -> read session transcripts, extract decisions/rationale/context that didn't make it into the stash or log. This recovers lost context from sessions that were saved quickly or not saved at all.

"Mine everything about X from February" -> filter squirrel entries by date and topic, then mine matching transcripts for deep context on that specific subject.

The squirrel resolves transcript paths using the same discovery mechanism as history (see `walnut:history` Transcript Discovery section).

---

## Output

Everything mine extracts goes through the stash. Nothing is written directly to walnut files during mining — it all routes at save.

- **Enriched capsule companions** — extraction tracking updated in frontmatter
- **Stash items** — decisions, tasks, insights, notes tagged with destination walnuts
- **Suggested new walnuts** — people, subjects that deserve their own space
- **Suggested new capsules** — themes or bodies of work emerging from sources
- **Suggested cross-links** — connections between walnuts discovered in sources

---

## What Mine Is NOT

- Not `walnut:capture` — capture brings new content IN. Mine extracts value from content already captured.
- Not `walnut:history` — history shows the session timeline. Mine goes deep on specific sources.
- Not `walnut:find` — find searches for known things. Mine discovers unknown things.

Capture is the intake. Mine is the refinery. History is the timeline. Find is the retrieval.
