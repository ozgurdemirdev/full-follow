import { BadRequestException } from "@nestjs/common";
import type { Core } from "@fullfollow/core";

/** Record types core builds chips for; the installed modules add theirs (`chatCards` contribution: tasks, people, companies, posts, opportunities, payments, drafts, templates, ...) */
export const CORE_CARD_TYPES = ["comment"] as const;
type CardType = string;
const MAX_KEYS = 30;
const SNIPPET = 80;

type Row = Record<string, any>;
export type CardRecord = { key: string; type: CardType; id: number; missing?: true } & Record<string, any>;

const clip = (s: string) => (s.length > SNIPPET ? `${s.slice(0, SNIPPET - 1)}…` : s);

/** "task:7,person:12" → [{type, id}]; unknown types and bad ids are a 400, more than MAX_KEYS too */
export function parseKeys(raw: string, validTypes: readonly string[]): { key: string; type: CardType; id: number; person?: number }[] {
  const parts = raw.split(",").map((k) => k.trim()).filter(Boolean);
  if (!parts.length || parts.length > MAX_KEYS) throw new BadRequestException(`1 ile ${MAX_KEYS} kayıt anahtarı gerekli`);
  return parts.map((key) => {
    // "template:5@12": a template filled for person 12
    const [head, at] = key.split("@");
    const [type, id] = head.split(":");
    const n = Number(id);
    const person = at === undefined ? undefined : Number(at);
    if (!validTypes.includes(type) || !Number.isInteger(n) || n <= 0 || (person !== undefined && (!Number.isInteger(person) || person <= 0))) {
      throw new BadRequestException(`geçersiz anahtar "${key}"`);
    }
    return { key, type, id: n, person };
  });
}

/** Live data for the cards of a reply (nothing is stored); a deleted or unknown record comes back as `missing` */
export function cardRecords(core: Core, keys: string): CardRecord[] {
  const valid = [...CORE_CARD_TYPES, ...core.ctx.types.chatCardTypes()];
  return parseKeys(keys, valid).map(({ key, type, id, person }) => {
    try {
      return { key, type, id, ...card(core, type, id, person) };
    } catch {
      return { key, type, id, missing: true };
    }
  });
}

function card(core: Core, type: CardType, id: number, personId?: number): Row {
  switch (type) {
    case "comment": {
      const r = core.get("comment", id).row as Row;
      return { title: clip(String(r.body ?? "")), target_label: r.target_label ?? null, resolved: !!r.resolved_at };
    }
    default: {
      const build = core.ctx.types.chatCard(type);
      if (!build) throw new Error(`no chip for ${type}`);
      return build(core.ctx, id, personId);
    }
  }
}
