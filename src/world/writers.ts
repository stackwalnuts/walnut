import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

// --- Helpers ---

function nowISO(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "");
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Convert a gray-matter value (which may be a Date object) to an ISO string.
 */
function toISOString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().replace(/\.\d{3}Z$/, "");
  }
  return String(value);
}

/**
 * Convert a kebab-case or slug name to Title Case.
 */
function toTitleCase(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Stringify frontmatter + content back to a markdown file.
 * gray-matter.stringify works but can reformat YAML in unexpected ways,
 * so we use it carefully.
 */
function stringifyMd(data: Record<string, unknown>, content: string): string {
  return matter.stringify(content, data);
}

// --- Tasks template ---

const TASKS_TEMPLATE = `---
walnut: unknown
updated: ${todayDate()}
---

## Urgent

## Active

## To Do

## Blocked

## Done
`;

// --- Writers ---

/**
 * Prepend a signed entry to log.md, newest first.
 */
export function prependLog(
  corePath: string,
  entry: { content: string; signature: string }
): void {
  const logPath = join(corePath, "log.md");
  const raw = readFileSync(logPath, "utf-8");
  const parsed = matter(raw);

  const timestamp = nowISO();

  // Build the new entry block
  const newEntry = `## ${timestamp} — ${entry.signature}\n\n${entry.content}\n\nsigned: ${entry.signature}\n`;

  // Prepend: new entry goes right after frontmatter, before existing content
  const existingContent = parsed.content.replace(/^\n+/, ""); // trim leading newlines
  const updatedContent = existingContent
    ? `\n${newEntry}\n${existingContent}`
    : `\n${newEntry}`;

  // Update frontmatter
  const currentCount =
    typeof parsed.data["entry-count"] === "number"
      ? parsed.data["entry-count"]
      : 0;
  parsed.data["entry-count"] = currentCount + 1;
  parsed.data["last-entry"] = timestamp;

  writeFileSync(logPath, stringifyMd(parsed.data, updatedContent));
}

/**
 * Add and/or complete tasks in tasks.md.
 */
export function updateTasks(
  corePath: string,
  changes: {
    add?: Array<{ text: string; section: string; attribution?: string }>;
    complete?: string[];
  }
): void {
  const tasksPath = join(corePath, "tasks.md");

  // Create from template if missing
  if (!existsSync(tasksPath)) {
    writeFileSync(tasksPath, TASKS_TEMPLATE);
  }

  let raw = readFileSync(tasksPath, "utf-8");

  // Complete tasks first
  if (changes.complete) {
    const today = todayDate();
    for (const taskText of changes.complete) {
      // Match both [ ] and [~] checkboxes containing the task text
      const escaped = taskText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `- \\[[ ~]\\] ${escaped}(\\s+@\\S+)?`,
        "g"
      );
      raw = raw.replace(pattern, (match, attribution) => {
        const attr = attribution ?? "";
        return `- [x] ${taskText} (${today})${attr}`;
      });
    }
  }

  // Add tasks
  if (changes.add) {
    for (const task of changes.add) {
      const sectionHeader = `## ${task.section}`;
      const idx = raw.indexOf(sectionHeader);
      if (idx === -1) continue; // Section not found — skip

      const afterHeader = idx + sectionHeader.length;
      const taskLine = task.attribution
        ? `- [ ] ${task.text}  @${task.attribution}`
        : `- [ ] ${task.text}`;

      // Find the end of the line after the section header
      const newlineAfterHeader = raw.indexOf("\n", afterHeader);
      if (newlineAfterHeader === -1) {
        // Section header is at end of file
        raw = raw + "\n" + taskLine + "\n";
      } else {
        // Insert after the header line (and any comment lines)
        raw =
          raw.slice(0, newlineAfterHeader + 1) +
          taskLine +
          "\n" +
          raw.slice(newlineAfterHeader + 1);
      }
    }
  }

  writeFileSync(tasksPath, raw);
}

/**
 * Regenerate now.md with updated frontmatter fields.
 * If `since` is provided, skip write if the file is fresher.
 */
export function regenerateNow(
  corePath: string,
  updates: {
    phase?: string;
    next?: string;
    capsule?: string;
    squirrel?: string;
  },
  since?: Date
): void {
  const nowPath = join(corePath, "now.md");
  const raw = readFileSync(nowPath, "utf-8");
  const parsed = matter(raw);

  // Freshness check: if `since` provided, compare against file's `updated`
  if (since) {
    const fileUpdated = parsed.data.updated;
    if (fileUpdated) {
      const fileDate = new Date(toISOString(fileUpdated));
      if (fileDate > since) {
        // File is fresher — skip
        return;
      }
    }
  }

  // Apply provided updates
  if (updates.phase !== undefined) parsed.data.phase = updates.phase;
  if (updates.next !== undefined) parsed.data.next = updates.next;
  if (updates.capsule !== undefined) parsed.data.capsule = updates.capsule;
  if (updates.squirrel !== undefined) parsed.data.squirrel = updates.squirrel;

  // Always update timestamp
  parsed.data.updated = nowISO();

  writeFileSync(nowPath, stringifyMd(parsed.data, parsed.content));
}

/**
 * Write a raw capture file into a capsule and update companion.md sources.
 */
export function writeCapture(
  corePath: string,
  capsuleName: string,
  filename: string,
  content: string,
  sourceMetadata: { description: string; type: string; date: string }
): void {
  const capsulePath = join(corePath, "_capsules", capsuleName);
  const rawDir = join(capsulePath, "raw");
  const companionPath = join(capsulePath, "companion.md");

  // Ensure directories exist
  mkdirSync(rawDir, { recursive: true });

  // Write the raw file
  writeFileSync(join(rawDir, filename), content);

  // Create companion if it doesn't exist
  if (!existsSync(companionPath)) {
    createCapsule(corePath, capsuleName, "Capture capsule", "reference");
  }

  // Update companion sources
  const companionRaw = readFileSync(companionPath, "utf-8");
  const parsed = matter(companionRaw);

  const sources = Array.isArray(parsed.data.sources)
    ? parsed.data.sources
    : [];
  sources.push({
    path: `raw/${filename}`,
    description: sourceMetadata.description,
    type: sourceMetadata.type,
    date: sourceMetadata.date,
  });
  parsed.data.sources = sources;
  parsed.data.updated = todayDate();

  writeFileSync(companionPath, stringifyMd(parsed.data, parsed.content));
}

/**
 * Write a new version draft into a capsule.
 * Returns the version string (e.g., "v0.3").
 */
export function writeDraft(
  corePath: string,
  capsuleName: string,
  content: string,
  changeSummary: string
): string {
  const capsulePath = join(corePath, "_capsules", capsuleName);
  const companionPath = join(capsulePath, "companion.md");

  // Find existing version files
  const files = readdirSync(capsulePath);
  const versionPattern = /^v(\d+)\.(\d+)\.md$/;
  let maxMajor = 0;
  let maxMinor = 0;
  let hasVersionFiles = false;

  for (const file of files) {
    const match = file.match(versionPattern);
    if (match) {
      hasVersionFiles = true;
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major > maxMajor || (major === maxMajor && minor > maxMinor)) {
        maxMajor = major;
        maxMinor = minor;
      }
    }
  }

  // Determine next version
  let nextMajor: number;
  let nextMinor: number;
  if (hasVersionFiles) {
    nextMajor = maxMajor;
    nextMinor = maxMinor + 1;
  } else {
    nextMajor = 0;
    nextMinor = 1;
  }

  const versionStr = `v${nextMajor}.${nextMinor}`;
  const versionFile = `${versionStr}.md`;

  // Write the draft file
  writeFileSync(join(capsulePath, versionFile), content);

  // Update companion.md
  const companionRaw = readFileSync(companionPath, "utf-8");
  const parsed = matter(companionRaw);

  parsed.data.version = versionStr;
  parsed.data.updated = todayDate();

  // Add changelog entry — insert after "## Changelog" heading
  let body = parsed.content;
  const changelogIdx = body.indexOf("## Changelog");
  if (changelogIdx !== -1) {
    const afterChangelog = body.indexOf("\n", changelogIdx);
    if (afterChangelog !== -1) {
      const changelogEntry = `\n### ${versionStr} (${todayDate()})\n${changeSummary}\n`;
      body =
        body.slice(0, afterChangelog + 1) +
        changelogEntry +
        body.slice(afterChangelog + 1);
    }
  }

  writeFileSync(companionPath, stringifyMd(parsed.data, body));

  return versionStr;
}

/**
 * Create a new capsule with full directory structure and companion.md.
 */
export function createCapsule(
  corePath: string,
  name: string,
  goal: string,
  capsuleType: "reference" | "work"
): void {
  const capsulePath = join(corePath, "_capsules", name);
  const rawDir = join(capsulePath, "raw");

  // Create directories
  mkdirSync(rawDir, { recursive: true });

  // Build companion.md
  const today = todayDate();
  const titleName = toTitleCase(name);

  const frontmatter: Record<string, unknown> = {
    type: "capsule",
    goal,
    status: "draft",
    version: "v0.1",
    sensitivity: "private",
    pii: false,
    created: today,
    updated: today,
    squirrels: [],
    active_sessions: [],
    sources: [],
    linked_capsules: [],
    tags: [],
  };

  const body = `
# ${titleName}

## Context

## Tasks

## Changelog

## Work Log
`;

  writeFileSync(join(capsulePath, "companion.md"), stringifyMd(frontmatter, body));
}
