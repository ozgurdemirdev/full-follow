import { z } from "zod";
import { ACTORS, FFError, isIsoDateTime } from "@fullfollow/core";
import { FEED_DEFAULT_LIMIT, FEED_KINDS, FEED_MAX_LIMIT, FEED_QUERY_MAX } from "../constants";

/** An empty query value (`?actor=`) counts as not given */
const given = (v: unknown) => (v === "" ? undefined : v);

export const feedQuery = z.strictObject({
  before: z.preprocess(given, z.string().trim().min(1).optional()),
  limit: z.preprocess(given, z.coerce.number().int().min(1).transform((n) => Math.min(n, FEED_MAX_LIMIT)).default(FEED_DEFAULT_LIMIT)),
  type: z.preprocess(given, z.string().trim().optional()),
  actor: z.preprocess(given, z.enum(ACTORS).optional()),
  since: z.preprocess(given, z.string().trim().refine(isIsoDateTime, "since: YYYY-MM-DD ya da ISO zaman olmalı").optional()),
  q: z.preprocess(given, z.string().trim().max(FEED_QUERY_MAX).optional()),
});

/** `temas,odeme` to the feed kinds it names; an unknown kind is a validation error */
export function kindsOf(list: string | undefined) {
  if (!list) return undefined;
  const kinds = list.split(",").map((k) => k.trim()).filter(Boolean);
  const bad = kinds.find((k) => !(FEED_KINDS as readonly string[]).includes(k));
  if (bad) throw new FFError("validation", `type: geçersiz tür "${bad}" (geçerli: ${FEED_KINDS.join(", ")})`);
  return kinds;
}

const encodeCursor = (at: string, id: number) => Buffer.from(`${at}|${id}`).toString("base64url");
export const cursorOf = (row: { created_at: string; id: number }) => encodeCursor(row.created_at, row.id);
export function decodeCursor(c: string): { at: string; id: number } {
  const [at, id] = Buffer.from(c, "base64url").toString().split("|");
  if (!at || !Number.isInteger(Number(id))) throw new FFError("validation", "geçersiz cursor");
  return { at, id: Number(id) };
}
