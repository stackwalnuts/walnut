import type { WalnutIndex } from "./scanner.js";

// --- Stop Words ---

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "as", "be", "was", "are",
  "that", "this", "not", "no", "so", "if", "do", "has", "had", "have",
]);

// --- Helpers ---

/**
 * Test whether `word` appears as a whole word inside `text`.
 * Both inputs should already be lowercased.
 * Handles hyphenated names like "glass-cathedral" correctly.
 */
function containsWholeWord(text: string, word: string): boolean {
  // Use a regex with word-boundary that also treats hyphens as part of the word.
  // \b works for start/end of alphanumeric sequences, but hyphens are
  // word-boundary characters, so we need a custom approach.
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "i");
  return re.test(text);
}

/**
 * Extract significant keywords from a goal string.
 * Splits on whitespace/punctuation and filters out stop words and short tokens.
 */
function extractKeywords(goal: string): string[] {
  return goal
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}"']+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

// --- Main ---

/**
 * Maps a message string to a walnut name using the WalnutIndex.
 * Pure string matching — no LLM calls.
 *
 * Resolution order (first match wins):
 * 1. Exact name match (whole word, case-insensitive, skip names < 3 chars)
 * 2. People match (first name, last name, or full name)
 * 3. Goal keyword match
 * 4. Tag match (word matches a tag that maps to exactly one walnut)
 * 5. Sticky context (recentWalnut fallback)
 * 6. null
 */
export function resolveWalnut(
  message: string,
  index: WalnutIndex,
  recentWalnut?: string
): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const lowerMessage = trimmed.toLowerCase();

  // --- 1. Exact name match ---
  for (const entry of index.walnuts) {
    if (entry.name.length < 3) continue;
    if (containsWholeWord(lowerMessage, entry.name.toLowerCase())) {
      return entry.name;
    }
  }

  // --- 2. People match ---
  // Collect all person-name tokens (full name, first name, last name) and
  // map each to the set of walnut names it resolves to.
  const personMatches = new Set<string>();

  for (const [fullName, walnutNames] of index.peopleIndex) {
    // Check full name first
    if (containsWholeWord(lowerMessage, fullName)) {
      for (const wn of walnutNames) personMatches.add(wn);
      continue;
    }

    // Check individual name parts (first name, last name, etc.)
    const parts = fullName.split(/\s+/).filter((p) => p.length >= 2);
    // Skip titles / honorifics for standalone matching
    const meaningfulParts = parts.filter(
      (p) => !["dr.", "mr.", "mrs.", "ms.", "prof."].includes(p)
    );

    for (const part of meaningfulParts) {
      if (containsWholeWord(lowerMessage, part)) {
        for (const wn of walnutNames) personMatches.add(wn);
      }
    }
  }

  if (personMatches.size === 1) {
    return [...personMatches][0];
  }
  // If ambiguous (> 1), fall through — don't return null yet, try goal match

  // --- 3. Goal keyword match ---
  const goalMatches = new Set<string>();

  for (const entry of index.walnuts) {
    if (!entry.goal) continue;
    const keywords = extractKeywords(entry.goal);
    for (const kw of keywords) {
      if (containsWholeWord(lowerMessage, kw)) {
        goalMatches.add(entry.name);
        break; // One keyword hit is enough for this walnut
      }
    }
  }

  if (goalMatches.size === 1) {
    return [...goalMatches][0];
  }

  // --- 4. Tag match ---
  const words = lowerMessage
    .split(/[\s,.;:!?()[\]{}"']+/)
    .filter((w) => w.length >= 2);

  for (const word of words) {
    const tagWalnuts = index.tagIndex.get(word);
    if (tagWalnuts && tagWalnuts.length === 1) {
      return tagWalnuts[0];
    }
  }

  // --- 5. Sticky context ---
  if (recentWalnut && index.byName.has(recentWalnut)) {
    return recentWalnut;
  }

  // --- 6. No match ---
  return null;
}
