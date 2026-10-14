import { contactKey, domainKey, keptRows, rows, type Ctx, type TouchMatch } from "@fullfollow/core";

/** A contact key is `kind:value`; the kinds the people and companies columns can answer (a `handle:` key is a bare word, answered by the free text handle of a person) */
const KINDS = ["email", "instagram", "linkedin"] as const;
type Kind = (typeof KINDS)[number];
const valueOf = (key: string, kind: string) => (key.startsWith(`${kind}:`) ? key.slice(kind.length + 1) : null);

interface Hit {
  kind: string;
  value: string;
  id: number;
  name: string;
}

/** Hits of one table for the given values per kind, one statement with the lists as JSON (the key columns are indexed) */
function lookup(ctx: Ctx, table: "people" | "companies", values: Record<Kind, string[]>): Hit[] {
  const sql = table === "people"
    ? `SELECT 'email' AS kind, email_key AS value, id, name FROM people WHERE email_key IN (SELECT value FROM json_each(?))
       UNION ALL SELECT 'instagram', instagram_key, id, name FROM people WHERE instagram_key IN (SELECT value FROM json_each(?))
       UNION ALL SELECT 'linkedin', linkedin_key, id, name FROM people WHERE linkedin_key IN (SELECT value FROM json_each(?)) ORDER BY id`
    : `SELECT 'email' AS kind, email_key AS value, id, name FROM companies WHERE email_key IN (SELECT value FROM json_each(?))
       UNION ALL SELECT 'instagram', instagram_key, id, name FROM companies WHERE instagram_key IN (SELECT value FROM json_each(?))
       UNION ALL SELECT 'linkedin', linkedin_key, id, name FROM companies WHERE linkedin_key IN (SELECT value FROM json_each(?)) ORDER BY id`;
  return keptRows<Hit>(ctx, sql, ...KINDS.map((k) => JSON.stringify(values[k])));
}

type Found = { id: number; name: string };
/** The first (oldest) hit per contact key */
const firstBy = (hits: Hit[]) => {
  const m = new Map<string, Found>();
  for (const h of hits) if (!m.has(`${h.kind}:${h.value}`)) m.set(`${h.kind}:${h.value}`, { id: h.id, name: h.name });
  return m;
};

/**
 * The person or company each contact key (the address of a loose touch) points at, found by the key columns the two modules keep for duplicate checks:
 * a person's e-mail, Instagram or LinkedIn, or a free text handle; else a company's e-mail, Instagram or LinkedIn; else, for an e-mail address,
 * the company whose website domain is the address's domain. A person beats a company; the oldest record wins a tie. Records of a module that is
 * not installed are never suggested. One pass for a whole list: the indexed columns are asked once per kind, never per touch.
 */
export function suggestMatches(ctx: Ctx, contactKeys: string[]): Map<string, TouchMatch> {
  const out = new Map<string, TouchMatch>();
  const keys = [...new Set(contactKeys)];
  if (!keys.length) return out;
  const values = Object.fromEntries(KINDS.map((k) => [k, keys.flatMap((key) => valueOf(key, k) ?? [])])) as Record<Kind, string[]>;
  const domains = [...new Set(values.email.flatMap((addr) => domainKey(addr) ?? []))];

  const people = ctx.mod("people") ? firstBy(lookup(ctx, "people", values)) : new Map<string, Found>();
  const companies = ctx.mod("companies") ? firstBy(lookup(ctx, "companies", values)) : new Map<string, Found>();
  // a person's free text handle ("@ada", "ada.design") has no key column: one read of the handles, only while some address is still unmatched
  const handles = new Map<string, Found>();
  if (ctx.mod("people") && keys.some((k) => !people.has(k))) {
    for (const p of rows<{ id: number; name: string; handle: string }>(ctx, "SELECT id, name, handle FROM people WHERE handle IS NOT NULL ORDER BY id")) {
      const k = contactKey(p.handle);
      if (k && !handles.has(k)) handles.set(k, { id: p.id, name: p.name });
    }
  }
  const byDomain = new Map<string, Found>();
  if (ctx.mod("companies") && domains.length) {
    for (const c of keptRows<{ id: number; name: string; domain_key: string }>(ctx,
      "SELECT id, name, domain_key FROM companies WHERE domain_key IN (SELECT value FROM json_each(?)) ORDER BY id", JSON.stringify(domains))) {
      if (!byDomain.has(c.domain_key)) byDomain.set(c.domain_key, { id: c.id, name: c.name });
    }
  }

  for (const key of keys) {
    const person = people.get(key) ?? handles.get(key);
    if (person) { out.set(key, { type: "person", ...person }); continue; }
    const company = companies.get(key) ?? (key.startsWith("email:") ? byDomain.get(domainKey(key.slice("email:".length)) ?? "") : undefined);
    if (company) out.set(key, { type: "company", ...company });
  }
  return out;
}
