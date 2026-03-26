<p align="center">
  <img src="alivecomputer-logo.png" alt="Stack Walnuts" width="600">
</p>

[![Version](https://img.shields.io/badge/version-0.2.0-copper)](https://github.com/stackwalnuts/claude-code/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Built for Claude Code](https://img.shields.io/badge/built%20for-Claude%20Code-blueviolet)](https://docs.anthropic.com/en/docs/claude-code)

# Walnut — Context Plugin for Claude Code

**Your AI forgets you every session. This fixes that.**

Walnut gives Claude Code structured, persistent memory. Your projects, people, decisions, and history live in plain files on your machine — and every session compounds on the last.

```bash
claude plugin install walnut@stackwalnuts
```

Then type `/walnut:world`.

<!-- TODO: demo visual goes here -->

---

## What changes

**Your AI knows you.** Every session loads your people, your decisions, your active work. No cold starts. No "remind me what we were doing." No re-explaining your business to a stranger.

**Your work has structure.** Capsules hold sources, drafts, and versions together. Work iterates toward something — then graduates when it ships. Not a pile of notes. A workshop.

**Plain files. Your machine.** Markdown in folders. Open in any editor. No cloud. No subscription. No one decides what happens to your context but you.

**Works beyond Claude Code.** Walnut is the context layer, not the agent. Any harness, any model — the files are the API.

**Nothing phones home.** No telemetry. No middleman. 12 hooks enforce the guardrails — all local, all yours to inspect.

---

## Skills

12 skills. All verbs. All short.

| Command | What it does |
|---------|-------------|
| `/walnut:world` | See everything — dashboard, health, route to action |
| `/walnut:load` | Load a walnut — people, capsules, context in tiers |
| `/walnut:save` | Checkpoint — route stash, update state, keep working |
| `/walnut:capture` | Bring external content in — store, route, extract |
| `/walnut:find` | Search across all walnuts — decisions, people, files |
| `/walnut:create` | Scaffold a new walnut with full structure |
| `/walnut:tidy` | System maintenance — stale drafts, orphan files, unsigned sessions |
| `/walnut:tune` | Customize voice, rhythm, and preferences |
| `/walnut:history` | Session timeline — what happened, when, why |
| `/walnut:mine` | Deep extraction from source material |
| `/walnut:extend` | Create custom skills, rules, and hooks |
| `/walnut:map` | Interactive force-directed graph of your world |

---

## How it works

### The walnut

A walnut is the unit of context. Any meaningful thing with its own identity, lifecycle, and history.

```
my-project/
  _core/
    key.md              identity — people, rhythm, tags, connections
    now.md              state — phase, next action, active capsule
    log.md              history — prepend-only, signed entries
    insights.md         knowledge — confirmed evergreen facts
    tasks.md            work — prioritized queue with attribution
    _squirrels/         session entries (one YAML per session)
    _capsules/          the workshop
      website-rebuild/
        companion.md    index — goal, status, sources, changelog
        v0.1.md         working draft
        v0.2.md         iterated
        raw/            source material
  website-rebuild/      graduated capsule (shipped, lives at root)
  docs/                 live context — your actual work
```

### The walnut domains

Five folders. The letters are the framework.

```
01_Archive/       Everything that was. Mirror paths. Graduation, not death.
02_Life/          Personal. Goals, people, patterns. The foundation.
03_Inputs/        Buffer only. Content arrives, gets routed out.
04_Ventures/      Revenue intent. Businesses, clients, products.
05_Experiments/   Testing grounds. Ideas, prototypes, explorations.
```

### The squirrel

The caretaker runtime. Not a chatbot personality — a portable set of behaviors that any model inherits when it enters a session.

**Instincts** (always running):
- Read before speaking — never answer from memory
- Capture proactively — external content enters the system or dies with the session
- Surface connections — cross-walnut references, people mentions, stale context
- Flag age — warn when context is older than the walnut's rhythm expects

**The stash** is the in-session scratchpad. Decisions, tasks, notes, insight candidates, and quotes accumulate during work. Nothing writes to walnut files mid-session (except capture and capsule drafts). At save, the stash routes to the right files — log, tasks, insights, cross-walnut dispatches.

### Capsules

Capsules model how work actually happens with AI — you prototype, iterate, ship, and the context compounds.

```
CAPTURE ──→ DRAFT ──→ PROTOTYPE ──→ PUBLISHED ──→ DONE
  │            │           │             │            │
  raw/         v0.1.md     v0.2.md       v0.3.md      v1.md
  sources      markdown    + visual      shared       graduated
                           (HTML)        externally   to walnut root
```

Each capsule is self-contained: a companion index, versioned drafts, and raw source material. Multiple agents can work on different capsules concurrently — active session claims prevent collisions.

When a capsule ships v1, it graduates from the workshop (`_core/_capsules/`) to the walnut root — becoming live context alongside the work it produced.

---

## Architecture

### Runtime injection

Walnut doesn't fine-tune a model or depend on a specific AI provider. It injects a **caretaker runtime** — a portable set of rules, skills, and hooks — into whatever agent starts a session.

```
Session starts
  → session-new hook fires
  → injects squirrel.core@1.0 via additionalContext
  → any model becomes a squirrel
  → reads the walnut's core files
  → resumes exactly where the last session left off
```

The runtime is the role. The model is the engine. Swap Claude for GPT, Gemini, or a local model — the squirrel still knows how to read a walnut, stash context, and save cleanly.

### Session lifecycle

Every session follows the same loop. No unclosed loops. No orphaned state.

```
LOAD ──→ WORK ──→ SAVE ──→ (continue or exit)
  │         │         │
  │         │         ├─ stash routed to files
  │         │         ├─ log entry prepended (signed)
  │         │         ├─ now.md regenerated from scratch
  │         │         └─ squirrel YAML signed
  │         │
  │         ├─ stash accumulates in conversation (not files)
  │         ├─ capture writes raw to capsules immediately
  │         └─ checkpoint every 5 items or 20 min (crash insurance)
  │
  ├─ core files read in sequence
  ├─ previous stash recovered if unsigned
  └─ one observation surfaced before work begins
```

If a session crashes, the next one recovers. The stash checkpoint in the squirrel YAML means nothing is lost. Every write is signed with session ID, runtime version, and engine.

### Zero-context standard

Any agent can pick up any walnut cold:

1. **key.md** — what this is, who's involved, how it connects
2. **now.md** — current phase, active capsule, next action
3. **tasks.md** — prioritized work queue with attribution
4. **insights.md** — standing domain knowledge (confirmed evergreen)
5. **log.md** — full history, newest first, every entry signed

No briefing doc. No onboarding call. The files ARE the context. Read them in order and you're caught up.

### Hook pipeline

12 hooks enforce system guarantees mechanically — not by asking the agent to follow rules, but by blocking violations before they happen.

| Hook | Trigger | Guarantee |
|------|---------|-----------|
| session-new | Session start | Runtime injected, squirrel entry created |
| session-resume | Session resume | Previous stash recovered |
| session-compact | Context compaction | Stash preserved across memory compression |
| log-guardian | Edit/Write to log.md | Signed entries are immutable |
| rules-guardian | Edit/Write to plugin files | System files can't be accidentally modified |
| root-guardian | Edit/Write to world root | Non-walnut files blocked, routed to walnut |
| archive-enforcer | Bash rm/rmdir | Nothing gets deleted — only archived |
| external-guard | Any MCP write tool | External actions require explicit confirmation |
| pre-compact | Before compaction | Timestamp recorded for session continuity |
| post-write | After file edit | Edit count tracked, statusline updated |
| inbox-check | After writing now.md | Surfaces unrouted items in Inputs |
| context-watch | Every user prompt | Context usage monitored, save nudges at thresholds |

---

## Background

Walnut was built in a lab — hundreds of hours of agent sessions across real ventures, testing context persistence, agent handoff, and the limits of what AI can reliably manage unsupervised.

### What we learned about safety

Agents without structural guardrails will:
- **Overwrite state** — editing files they shouldn't, silently replacing context from previous sessions
- **Perform irreversible actions** — deleting files, force-pushing branches, sending messages without confirmation
- **Leak sensitive data** — writing API keys into committed files, hardcoding paths with personal information
- **Drop context silently** — losing stash items to session crashes, forgetting the previous `next:` action, conflating walnut scopes
- **Fabricate confidence** — answering from "memory" instead of reading the source of truth

Every hook in the system exists because one of these things happened. These aren't theoretical — they're scar tissue from real failures.

### What we learned about context

The capsule architecture came from observing how work actually flows with AI: you capture raw material, draft something, iterate with feedback, ship it, and the context compounds into the next thing. The system models that workflow structurally rather than hoping the agent remembers it.

The zero-context standard — the requirement that any new agent can pick up any walnut cold — forced every design decision toward explicit, file-based state. No hidden memory. No session-dependent knowledge. If it's not in the files, it doesn't exist.

---

## Core principles

- **Context as property.** Your files, your machine, your cloud. Nothing phones home.
- **Zero-context standard.** Any new agent picks up any walnut cold and continues.
- **Surface, don't decide.** The squirrel shows what it found. You choose what stays.
- **Capture before it's lost.** What lives only in conversation dies with the session.
- **No unclosed loops.** Every session loads cleanly, works tracked, saves completely.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Community

- [GitHub Discussions](https://github.com/stackwalnuts/claude-code/discussions) — bugs, features, ideas

---

If Walnut makes your AI smarter, [star the repo](https://github.com/stackwalnuts/claude-code) — it helps others find it.

## License

MIT. Open source. Build your world.
