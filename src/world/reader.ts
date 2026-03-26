import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import matter from "gray-matter";
import { scanWorld } from "./scanner.js";

// --- Types ---

export interface ReadOptions {
  logEntries?: number; // default 10
  maxChars?: number; // default 15000 (budget for system prompt injection)
}

interface CapsuleInfo {
  name: string;
  goal: string;
  status: string;
  version: string;
}

// --- File Reading Helpers ---

/**
 * Safely read a file, returning null if it doesn't exist or can't be read.
 */
function safeReadFile(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Read a file and return its full content (frontmatter + body).
 */
function readFullFile(filePath: string): string | null {
  return safeReadFile(filePath);
}

/**
 * Read a file and return only its frontmatter as YAML text.
 */
function readFrontmatterOnly(filePath: string): string | null {
  const raw = safeReadFile(filePath);
  if (!raw) return null;

  try {
    const { data } = matter(raw);
    // Convert frontmatter object back to YAML-like text
    const lines: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Date) {
        lines.push(`${key}: ${value.toISOString().split("T")[0]}`);
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${key}: []`);
        } else {
          lines.push(`${key}:`);
          for (const item of value) {
            lines.push(`  - ${String(item)}`);
          }
        }
      } else if (value === null || value === undefined) {
        lines.push(`${key}: null`);
      } else {
        lines.push(`${key}: ${String(value)}`);
      }
    }
    return lines.join("\n");
  } catch {
    return null;
  }
}

/**
 * Read log.md and return the first N entries after frontmatter.
 * Log is prepend-only, so newest entries are at the top after frontmatter.
 * Entries start with "## " (h2 headers with date stamps).
 */
function readLogEntries(filePath: string, maxEntries: number): string | null {
  const raw = safeReadFile(filePath);
  if (!raw) return null;

  try {
    const { content } = matter(raw);

    // Split content into entries by ## headers
    const lines = content.split("\n");
    const entries: string[][] = [];
    let currentEntry: string[] = [];
    let foundFirstEntry = false;

    for (const line of lines) {
      if (line.startsWith("## ")) {
        if (foundFirstEntry && currentEntry.length > 0) {
          entries.push(currentEntry);
        }
        currentEntry = [line];
        foundFirstEntry = true;
      } else if (foundFirstEntry) {
        currentEntry.push(line);
      }
    }
    // Push the last entry
    if (currentEntry.length > 0 && foundFirstEntry) {
      entries.push(currentEntry);
    }

    // Take only the first maxEntries
    const truncated = entries.slice(0, maxEntries);
    return truncated.map((e) => e.join("\n")).join("\n");
  } catch {
    return null;
  }
}

/**
 * Scan _capsules directory and read companion.md frontmatter from each.
 * Looks for _capsules at corePath level AND at walnut root (parent of _core/).
 */
function readCapsules(corePath: string): CapsuleInfo[] {
  const capsules: CapsuleInfo[] = [];

  // Check for _capsules at corePath (flat walnut) and at parent (if _core/ structure)
  const possiblePaths = [
    join(corePath, "_capsules"),
    join(dirname(corePath), "_capsules"),
  ];

  // Deduplicate if corePath == walnutRoot (flat walnut)
  const checked = new Set<string>();

  for (const capsulesDir of possiblePaths) {
    if (checked.has(capsulesDir)) continue;
    checked.add(capsulesDir);

    if (!existsSync(capsulesDir)) continue;

    let entries: string[];
    try {
      entries = readdirSync(capsulesDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const companionPath = join(capsulesDir, entry, "companion.md");
      if (!existsSync(companionPath)) continue;

      try {
        const raw = readFileSync(companionPath, "utf-8");
        const { data } = matter(raw);

        capsules.push({
          name: entry,
          goal: String(data.goal ?? ""),
          status: String(data.status ?? "unknown"),
          version: String(data.version ?? ""),
        });
      } catch {
        // Skip unreadable capsules
      }
    }
  }

  return capsules;
}

/**
 * Truncate tasks to only Urgent and Active sections.
 */
function truncateTasks(tasksContent: string): string {
  const lines = tasksContent.split("\n");
  const result: string[] = [];
  let inAllowedSection = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const sectionName = line.replace("## ", "").trim();
      inAllowedSection =
        sectionName === "Urgent" || sectionName === "Active";
      if (inAllowedSection) {
        result.push(line);
      }
    } else if (inAllowedSection) {
      result.push(line);
    }
  }

  return result.join("\n").trim();
}

// --- Main Export ---

/**
 * Reads the core read sequence for a walnut and returns assembled text
 * suitable for system prompt injection.
 */
export function readBriefPack(
  corePath: string,
  walnutName: string,
  options: ReadOptions = {}
): string {
  const logEntries = options.logEntries ?? 10;
  const maxChars = options.maxChars ?? 15000;

  // --- Read all files ---
  const keyContent = readFullFile(join(corePath, "key.md"));
  const nowContent = readFullFile(join(corePath, "now.md"));
  let tasksContent = readFullFile(join(corePath, "tasks.md"));
  const insightsFrontmatter = readFrontmatterOnly(
    join(corePath, "insights.md")
  );
  let logContent = readLogEntries(join(corePath, "log.md"), logEntries);
  const capsules = readCapsules(corePath);

  // --- Format capsules section ---
  let capsulesText: string;
  if (capsules.length === 0) {
    capsulesText = "None";
  } else {
    capsulesText = capsules
      .map(
        (c) =>
          `- ${c.name}: ${c.goal} (status: ${c.status}, ${c.version})`
      )
      .join("\n");
  }

  // --- Assemble the brief pack ---
  function assemble(
    tasksSectionContent: string | null,
    logSectionContent: string | null
  ): string {
    const sections: string[] = [];

    sections.push(`## Walnut: ${walnutName}\n`);

    sections.push("### Identity");
    sections.push(keyContent ?? "No key.md found.");
    sections.push("");

    sections.push("### Current State");
    sections.push(nowContent ?? "No now.md found.");
    sections.push("");

    sections.push("### Tasks");
    sections.push(tasksSectionContent ?? "No tasks.md found.");
    sections.push("");

    sections.push("### Domain Knowledge");
    sections.push(insightsFrontmatter ?? "No insights.md found.");
    sections.push("");

    sections.push(
      `### Recent History (last ${logEntries} entries)`
    );
    sections.push(logSectionContent ?? "No log.md found.");
    sections.push("");

    sections.push("### Active Capsules");
    sections.push(capsulesText);

    return sections.join("\n");
  }

  // --- Budget enforcement ---
  let result = assemble(tasksContent, logContent);

  if (result.length > maxChars) {
    // Step 1: Reduce log entries progressively
    let currentLogEntries = logEntries;
    while (result.length > maxChars && currentLogEntries > 0) {
      currentLogEntries = Math.max(0, currentLogEntries - 2);
      logContent =
        currentLogEntries > 0
          ? readLogEntries(join(corePath, "log.md"), currentLogEntries)
          : null;
      result = assemble(tasksContent, logContent);
    }

    // Step 2: Truncate tasks (keep only Urgent and Active)
    if (result.length > maxChars && tasksContent) {
      tasksContent = truncateTasks(tasksContent);
      result = assemble(tasksContent, logContent);
    }

    // Step 3: Final hard truncation if still over budget
    if (result.length > maxChars) {
      result = result.slice(0, maxChars);
    }
  }

  return result;
}

/**
 * For when no specific walnut is loaded. Returns a compact summary of all walnuts.
 * Uses scanWorld internally. Omits Archive domain.
 */
export async function readWorldSummary(worldPath: string): Promise<string> {
  const index = await scanWorld(worldPath);

  // Group by domain, excluding Archive
  const domainGroups = new Map<string, typeof index.walnuts>();

  for (const walnut of index.walnuts) {
    if (walnut.domain === "Archive") continue;

    if (!domainGroups.has(walnut.domain)) {
      domainGroups.set(walnut.domain, []);
    }
    domainGroups.get(walnut.domain)!.push(walnut);
  }

  const sections: string[] = [];
  sections.push("## World Summary\n");

  // Stable domain ordering
  const domainOrder = ["Ventures", "Life", "Experiments", "Inputs"];

  for (const domain of domainOrder) {
    const walnuts = domainGroups.get(domain);
    if (!walnuts || walnuts.length === 0) continue;

    sections.push(`### ${domain}`);
    for (const w of walnuts) {
      const phase = w.phase ? `(${w.phase})` : "";
      sections.push(
        `- ${w.name}: ${w.goal} ${phase} -- ${w.health}`.trim()
      );
    }
    sections.push("");
  }

  if (sections.length <= 1) {
    sections.push("No active walnuts found.");
  }

  return sections.join("\n");
}
