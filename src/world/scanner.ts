import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename, relative } from "node:path";
import matter from "gray-matter";

// --- Types ---

export interface WalnutEntry {
  name: string;
  path: string;
  corePath: string;
  domain: string;
  type: string;
  goal: string;
  rhythm: string;
  tags: string[];
  people: Array<{ name: string; role: string }>;
  links: string[];
  phase: string | null;
  next: string | null;
  updated: string | null;
  health: "active" | "quiet" | "waiting";
  parent: string | null;
}

export interface WalnutIndex {
  walnuts: WalnutEntry[];
  byName: Map<string, WalnutEntry>;
  peopleIndex: Map<string, string[]>;
  tagIndex: Map<string, string[]>;
}

// --- Constants ---

const DOMAIN_FOLDERS = [
  "01_Archive",
  "02_Life",
  "03_Inputs",
  "04_Ventures",
  "05_Experiments",
] as const;

const DOMAIN_NAMES: Record<string, string> = {
  "01_Archive": "Archive",
  "02_Life": "Life",
  "03_Inputs": "Inputs",
  "04_Ventures": "Ventures",
  "05_Experiments": "Experiments",
};

const RHYTHM_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

// --- Health Calculation ---

function calculateHealth(
  type: string,
  rhythm: string | undefined,
  updated: string | null
): "active" | "quiet" | "waiting" {
  // People walnuts always active
  if (type === "person") return "active";

  // No rhythm or no updated date → waiting
  if (!rhythm || !updated || !(rhythm in RHYTHM_DAYS)) return "waiting";

  const rhythmDays = RHYTHM_DAYS[rhythm];
  const updatedDate = new Date(updated + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - updatedDate.getTime();
  const daysSince = diffMs / (1000 * 60 * 60 * 24);

  if (daysSince <= rhythmDays) return "active";
  if (daysSince <= rhythmDays * 2) return "quiet";
  return "waiting";
}

// --- Utilities ---

/**
 * Convert a value to an ISO date string (YYYY-MM-DD).
 * gray-matter auto-converts unquoted date strings to Date objects,
 * so we need to handle both Date and string inputs.
 */
function toDateString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  return String(value);
}

// --- Frontmatter Parsing ---

function parseKeyMd(filePath: string): Record<string, unknown> | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const { data } = matter(raw);
    return data;
  } catch {
    return null;
  }
}

function parseNowMd(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf-8");
    const { data } = matter(raw);
    return data;
  } catch {
    return null;
  }
}

// --- Domain Detection ---

function detectDomain(walnutPath: string, worldPath: string): string {
  const rel = relative(worldPath, walnutPath);
  const topFolder = rel.split("/")[0];
  return DOMAIN_NAMES[topFolder] ?? "Unknown";
}

// --- Recursive Key.md Discovery ---

interface FoundKeyMd {
  keyMdPath: string;
  walnutRoot: string;
  corePath: string;
}

/**
 * Recursively walk a directory tree to find all key.md files.
 * When both _core/key.md and root key.md exist, only _core/key.md is used.
 * Returns deduplicated entries — one per walnut.
 */
function findKeyMdFiles(dir: string): FoundKeyMd[] {
  const results: FoundKeyMd[] = [];

  // We need to walk the directory tree and find directories that contain key.md
  // either directly or inside a _core/ subdirectory.
  walkForWalnuts(dir, results);

  return results;
}

function walkForWalnuts(dir: string, results: FoundKeyMd[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  const hasCore = entries.includes("_core");
  const hasCoreKeyMd =
    hasCore &&
    existsSync(join(dir, "_core", "key.md")) &&
    statSync(join(dir, "_core", "key.md")).isFile();
  const hasRootKeyMd =
    entries.includes("key.md") &&
    statSync(join(dir, "key.md")).isFile();

  if (hasCoreKeyMd) {
    // _core/key.md takes precedence
    results.push({
      keyMdPath: join(dir, "_core", "key.md"),
      walnutRoot: dir,
      corePath: join(dir, "_core"),
    });
  } else if (hasRootKeyMd) {
    // Flat walnut — key.md at root
    results.push({
      keyMdPath: join(dir, "key.md"),
      walnutRoot: dir,
      corePath: dir,
    });
  }

  // Recurse into subdirectories, but skip _core/, _capsules/, _squirrels/, .alive/
  for (const entry of entries) {
    if (entry.startsWith(".") || entry === "_core" || entry === "_capsules" || entry === "_squirrels") {
      continue;
    }
    const fullPath = join(dir, entry);
    try {
      if (statSync(fullPath).isDirectory()) {
        walkForWalnuts(fullPath, results);
      }
    } catch {
      // Skip entries we can't stat
    }
  }
}

// --- Build Entry ---

function buildEntry(
  found: FoundKeyMd,
  worldPath: string
): WalnutEntry | null {
  const keyData = parseKeyMd(found.keyMdPath);
  if (!keyData) return null;

  const nowPath = join(found.corePath, "now.md");
  const nowData = parseNowMd(nowPath);

  const type = String(keyData.type ?? "");
  const rhythm = keyData.rhythm != null ? String(keyData.rhythm) : "";
  const updated = nowData?.updated != null ? toDateString(nowData.updated) : null;

  // Parse people — could be array of objects or array of strings
  const rawPeople = Array.isArray(keyData.people) ? keyData.people : [];
  const people: Array<{ name: string; role: string }> = rawPeople.map(
    (p: unknown) => {
      if (typeof p === "object" && p !== null && "name" in p) {
        const obj = p as Record<string, unknown>;
        return {
          name: String(obj.name ?? ""),
          role: String(obj.role ?? ""),
        };
      }
      return { name: String(p), role: "" };
    }
  );

  // Parse tags
  const tags: string[] = Array.isArray(keyData.tags)
    ? keyData.tags.map(String)
    : [];

  // Parse links
  const links: string[] = Array.isArray(keyData.links)
    ? keyData.links.map(String)
    : [];

  // Parse parent
  const parent =
    keyData.parent != null && keyData.parent !== "null"
      ? String(keyData.parent)
      : null;

  return {
    name: basename(found.walnutRoot),
    path: found.walnutRoot,
    corePath: found.corePath,
    domain: detectDomain(found.walnutRoot, worldPath),
    type,
    goal: String(keyData.goal ?? ""),
    rhythm,
    tags,
    people,
    links,
    phase: nowData?.phase != null ? String(nowData.phase) : null,
    next: nowData?.next != null ? String(nowData.next) : null,
    updated,
    health: calculateHealth(type, rhythm || undefined, updated),
    parent,
  };
}

// --- Main ---

export async function scanWorld(worldPath: string): Promise<WalnutIndex> {
  const walnuts: WalnutEntry[] = [];
  const byName = new Map<string, WalnutEntry>();
  const peopleIndex = new Map<string, string[]>();
  const tagIndex = new Map<string, string[]>();

  for (const domainFolder of DOMAIN_FOLDERS) {
    const domainPath = join(worldPath, domainFolder);
    if (!existsSync(domainPath)) continue;

    const found = findKeyMdFiles(domainPath);

    for (const f of found) {
      const entry = buildEntry(f, worldPath);
      if (!entry) continue;

      walnuts.push(entry);
      byName.set(entry.name, entry);

      // Build people index
      for (const person of entry.people) {
        const key = person.name.toLowerCase();
        if (!peopleIndex.has(key)) {
          peopleIndex.set(key, []);
        }
        peopleIndex.get(key)!.push(entry.name);
      }

      // Build tag index
      for (const tag of entry.tags) {
        if (!tagIndex.has(tag)) {
          tagIndex.set(tag, []);
        }
        tagIndex.get(tag)!.push(entry.name);
      }
    }
  }

  return { walnuts, byName, peopleIndex, tagIndex };
}
