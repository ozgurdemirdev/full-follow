// Structured parts of a reply: ```ff-cards and ```ff-suggest fenced blocks (see the chat system rules)
export interface CardItem {
  type: string;
  id: number;
  person_id?: number;
}
export interface CardGroup {
  label?: string;
  items: CardItem[];
}
export interface Suggest {
  label: string;
  action: "task_done";
  id: number;
}

const FENCE = "```";
const warned = new Set<string>();

/** A block still being written (opening fence with an ff- language and no closing fence yet): cut it off so raw JSON never shows */
export function splitOpenFence(body: string): { text: string; open: boolean } {
  const first = body.indexOf(FENCE);
  if (first < 0) return { text: body, open: false };
  const fences = body.split(FENCE).length - 1;
  const last = body.lastIndexOf(FENCE);
  if (fences % 2 === 1 && body.slice(last + 3).startsWith("ff-")) return { text: body.slice(0, last), open: true };
  return { text: body, open: false };
}

function warnOnce(what: string, src: string) {
  if (warned.has(src)) return;
  warned.add(src);
  console.warn(`chat: ${what} bloğu geçersiz JSON, gösterilmedi`);
}

/** null on anything that is not the documented shape (nothing is rendered, one console warning) */
export function parseCards(src: string): CardGroup[] | null {
  try {
    const j = JSON.parse(src);
    const groups = (j?.groups as CardGroup[] | undefined)?.map((g) => ({
      label: typeof g.label === "string" ? g.label : undefined,
      items: (g.items ?? []).filter((i) => typeof i?.type === "string" && Number.isInteger(i?.id) && i.id > 0),
    }));
    if (!groups?.length) throw new Error("no groups");
    return groups;
  } catch {
    warnOnce("ff-cards", src);
    return null;
  }
}

export function parseSuggest(src: string): Suggest | null {
  try {
    const j = JSON.parse(src);
    if (j?.action !== "task_done" || !Number.isInteger(j.id) || typeof j.label !== "string") throw new Error("shape");
    return { label: j.label, action: "task_done", id: j.id };
  } catch {
    warnOnce("ff-suggest", src);
    return null;
  }
}

/** Reply text without the ff-suggest block (it renders as buttons under the user's message) plus the suggestion itself */
export function extractSuggest(body: string): { text: string; suggest: Suggest | null } {
  const m = /```ff-suggest\s*([\s\S]*?)```/.exec(body);
  if (!m) return { text: body, suggest: null };
  return { text: body.replace(m[0], "").trim(), suggest: parseSuggest(m[1]) };
}

export const cardKey = (i: CardItem) => `${i.type}:${i.id}${i.type === "template" && i.person_id ? `@${i.person_id}` : ""}`;
