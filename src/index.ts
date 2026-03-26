#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { readBriefPack, readWorldSummary } from "./world/reader.js";
import { scanWorld } from "./world/scanner.js";
import {
  prependLog,
  regenerateNow,
  updateTasks,
  writeCapture,
} from "./world/writers.js";

// --- World path resolution ---
// First CLI arg, or WALNUT_WORLD_PATH env var, or ~/world default.
const worldPath: string =
  process.argv[2] ||
  process.env.WALNUT_WORLD_PATH ||
  join(homedir(), "world");

// --- Server ---

const server = new McpServer({
  name: "walnut-mcp",
  version: "0.1.0",
});

// ============================================================
// Tool 1: walnut_read
// ============================================================
server.tool(
  "walnut_read",
  "Read a walnut's brief pack (key, now, tasks, insights, log, capsules)",
  {
    walnut: z.string().describe("Walnut name (folder name, e.g. 'alive-gtm')"),
  },
  async ({ walnut }) => {
    try {
      const index = await scanWorld(worldPath);
      const entry = index.byName.get(walnut);

      if (!entry) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Walnut "${walnut}" not found. Use walnut_list to see available walnuts.`,
            },
          ],
        };
      }

      const briefPack = readBriefPack(entry.corePath, entry.name);
      return {
        content: [{ type: "text" as const, text: briefPack }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error reading walnut: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 2: walnut_list
// ============================================================
server.tool(
  "walnut_list",
  "List all walnuts in the world with their domain, goal, phase, and health",
  {},
  async () => {
    try {
      const summary = await readWorldSummary(worldPath);
      return {
        content: [{ type: "text" as const, text: summary }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing walnuts: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 3: walnut_save (combined log + now + tasks operation)
// ============================================================
server.tool(
  "walnut_save",
  "Save progress to a walnut: prepend log entry, update now.md state, and manage tasks",
  {
    walnut: z.string().describe("Walnut name"),
    logEntry: z.string().describe("Content to prepend to log.md"),
    phase: z.string().optional().describe("Update phase in now.md"),
    next: z.string().optional().describe("Update next action in now.md"),
    capsule: z.string().optional().describe("Update active capsule in now.md"),
    addTasks: z
      .string()
      .optional()
      .describe(
        'JSON array of {text, section} objects to add to tasks.md (e.g. [{"text":"Build API","section":"Active"}])'
      ),
    completeTasks: z
      .string()
      .optional()
      .describe(
        'JSON array of task text strings to mark complete (e.g. ["Build API","Fix bug"])'
      ),
  },
  async ({ walnut, logEntry, phase, next, capsule, addTasks, completeTasks }) => {
    try {
      const index = await scanWorld(worldPath);
      const entry = index.byName.get(walnut);

      if (!entry) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Walnut "${walnut}" not found. Use walnut_list to see available walnuts.`,
            },
          ],
        };
      }

      const corePath = entry.corePath;
      const actions: string[] = [];

      // 1. Prepend log with base36 timestamp signature
      const signature = `walnut-mcp:${Date.now().toString(36)}`;
      prependLog(corePath, { content: logEntry, signature });
      actions.push(`Logged entry (signed: ${signature})`);

      // 2. Regenerate now.md if any state fields provided
      if (phase !== undefined || next !== undefined || capsule !== undefined) {
        const updates: { phase?: string; next?: string; capsule?: string } = {};
        if (phase !== undefined) updates.phase = phase;
        if (next !== undefined) updates.next = next;
        if (capsule !== undefined) updates.capsule = capsule;
        regenerateNow(corePath, updates);
        actions.push(
          `Updated now.md: ${Object.entries(updates).map(([k, v]) => `${k}="${v}"`).join(", ")}`
        );
      }

      // 3. Update tasks if any provided
      if (addTasks !== undefined || completeTasks !== undefined) {
        const taskChanges: {
          add?: Array<{ text: string; section: string }>;
          complete?: string[];
        } = {};

        if (addTasks !== undefined) {
          taskChanges.add = JSON.parse(addTasks) as Array<{
            text: string;
            section: string;
          }>;
        }
        if (completeTasks !== undefined) {
          taskChanges.complete = JSON.parse(completeTasks) as string[];
        }

        updateTasks(corePath, taskChanges);

        const taskSummary: string[] = [];
        if (taskChanges.add) taskSummary.push(`added ${taskChanges.add.length} task(s)`);
        if (taskChanges.complete)
          taskSummary.push(`completed ${taskChanges.complete.length} task(s)`);
        actions.push(`Tasks: ${taskSummary.join(", ")}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Saved to ${walnut}:\n${actions.map((a) => `- ${a}`).join("\n")}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error saving to walnut: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 4: walnut_capture
// ============================================================
server.tool(
  "walnut_capture",
  "Capture content into a walnut's capsule or the world's Inputs folder",
  {
    walnut: z.string().describe("Walnut name"),
    content: z.string().describe("The content to capture"),
    filename: z.string().describe("Filename for the captured content"),
    description: z.string().describe("Description of what was captured"),
    contentType: z
      .string()
      .describe("Type of content (e.g. 'transcript', 'note', 'reference', 'snippet')"),
    capsule: z
      .string()
      .optional()
      .describe("Capsule name to capture into. If omitted, writes to 03_Inputs/"),
  },
  async ({ walnut, content, filename, description, contentType, capsule }) => {
    try {
      const index = await scanWorld(worldPath);
      const entry = index.byName.get(walnut);

      if (!entry) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Walnut "${walnut}" not found. Use walnut_list to see available walnuts.`,
            },
          ],
        };
      }

      if (capsule) {
        // Write into capsule's raw/ directory
        const today = new Date().toISOString().split("T")[0];
        writeCapture(entry.corePath, capsule, filename, content, {
          description,
          type: contentType,
          date: today,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Captured to ${walnut}/_capsules/${capsule}/raw/${filename}`,
            },
          ],
        };
      } else {
        // Write to world-level 03_Inputs/
        const inputsDir = join(worldPath, "03_Inputs");
        mkdirSync(inputsDir, { recursive: true });
        const filePath = join(inputsDir, filename);
        writeFileSync(filePath, content);
        return {
          content: [
            {
              type: "text" as const,
              text: `Captured to 03_Inputs/${filename}`,
            },
          ],
        };
      }
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error capturing content: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 5: walnut_create
// ============================================================
server.tool(
  "walnut_create",
  "Create a new walnut with full directory structure and core files",
  {
    name: z
      .string()
      .describe("Walnut name in kebab-case (e.g. 'my-project')"),
    domain: z.enum([
      "01_Archive",
      "02_Life",
      "03_Inputs",
      "04_Ventures",
      "05_Experiments",
    ]).describe("Domain folder to create the walnut in"),
    goal: z.string().describe("The walnut's goal statement"),
    type: z.enum([
      "venture",
      "person",
      "experiment",
      "life",
      "project",
      "campaign",
    ]).describe("Walnut type"),
  },
  async ({ name, domain, goal, type }) => {
    try {
      const walnutDir = join(worldPath, domain, name);

      if (existsSync(walnutDir)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Walnut "${name}" already exists at ${walnutDir}`,
            },
          ],
        };
      }

      // Create directory structure
      const coreDir = join(walnutDir, "_core");
      const capsulesDir = join(walnutDir, "_capsules");
      mkdirSync(coreDir, { recursive: true });
      mkdirSync(capsulesDir, { recursive: true });

      const today = new Date().toISOString().split("T")[0];
      const titleName = name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      // key.md
      const keyMd = `---
type: ${type}
goal: "${goal}"
rhythm: weekly
sensitivity: private
pii: false
created: ${today}
tags: []
people: []
links: []
---

# ${titleName}
`;
      writeFileSync(join(coreDir, "key.md"), keyMd);

      // now.md
      const nowMd = `---
phase: setup
updated: ${today}
next: ""
capsule: ""
squirrel: ""
---
`;
      writeFileSync(join(coreDir, "now.md"), nowMd);

      // log.md
      const logMd = `---
entry-count: 1
last-entry: ${today}
---

## ${today} — walnut-mcp:genesis

Walnut created. Goal: ${goal}

signed: walnut-mcp:genesis
`;
      writeFileSync(join(coreDir, "log.md"), logMd);

      // insights.md
      const insightsMd = `---
walnut: ${name}
updated: ${today}
---
`;
      writeFileSync(join(coreDir, "insights.md"), insightsMd);

      // tasks.md
      const tasksMd = `---
walnut: ${name}
updated: ${today}
---

## Urgent

## Active

## To Do

## Blocked

## Done
`;
      writeFileSync(join(coreDir, "tasks.md"), tasksMd);

      return {
        content: [
          {
            type: "text" as const,
            text: `Created walnut "${name}" at ${walnutDir}\nFiles: key.md, now.md, log.md, insights.md, tasks.md\nDirs: _core/, _capsules/`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating walnut: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`walnut-mcp server running on stdio (world: ${worldPath})`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
