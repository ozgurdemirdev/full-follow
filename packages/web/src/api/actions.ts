// Yazma işlemleri: API çağrısı + ilgili önbellekleri tazeleme + kısa bildirim
import { invalidatesFor } from "../app/modules/registry";
import { PATHS } from "../app/routes";
import { toast, type ToastAction } from "../components/toast";
import { api, ApiError } from "./client";
import { invalidate } from "./store";
import type { Mutation } from "./types";

const CONTACTS = ["/people", "/companies", "/today", "/timeline", "/network", "/touches", "/stats", "/review"];

/** Her yazma işleminden sonra hangi listelerin tazeleneceği (modüller kendi verilerini manifest `invalidates` ile ekler) */
const AFFECTS: Record<string, string[]> = {
  people: [...CONTACTS, "/opportunities", "/sectors", "/tags", "/sources", "/report", "/posts", "/ideas", "/trash"],
  companies: [...CONTACTS, "/opportunities", "/sectors", "/tags", "/sources", "/drafts", "/trash"],
  sectors: ["/sectors", "/people", "/companies", "/trash", "/templates", "/ideas"],
  tags: ["/tags", "/people", "/companies", "/trash"],
  notes: ["/notes", "/people", "/timeline", "/trash"],
  links: ["/links", "/own-projects", "/timeline", "/trash"],
  offers: ["/opportunities", "/timeline", "/trash"],
  files: ["/opportunities", "/projects", "/timeline", "/trash"],
  "opportunity-people": ["/opportunities", "/timeline", "/trash"],
  sources: ["/sources", "/opportunities", "/report", "/people", "/companies", "/trash"],
  opportunities: ["/opportunities", "/today", "/timeline", "/projects", "/people", "/companies", "/report", "/payments", "/sources", "/trash"],
  drafts: ["/drafts", "/settings", "/today", "/timeline", "/touches", "/opportunities", "/people", "/companies", "/network", "/templates", "/followups", "/trash"],
  touches: [...CONTACTS, "/opportunities", "/ideas", "/followups", "/trash"],
  comments: ["/comments", "/own-projects", "/today", "/timeline", "/people", "/companies", "/trash"],
  settings: ["/settings", "/report", "/review", "/today", "/people", "/network", "/followups"],
  posts: ["/posts", "/today", "/people", "/ideas", "/report", "/trash"],
  templates: ["/templates", "/trash"],
  ideas: ["/ideas", "/own-projects", "/people", "/posts", "/touches", "/timeline", "/trash"],
  followups: ["/followups", "/drafts", "/today", "/people", "/companies"],
  // geri yükleme her şeyi etkileyebilir
  trash: ["/"],
};

/** Mükerrer kaydın yeri: kişi ve firma kartı, kategoriler Ayarlar'da */
export const recordHref = (type: string, id: number) =>
  type === "person" ? `${PATHS.people}/${id}` : type === "company" ? `${PATHS.companies}/${id}` : PATHS.settings;

type DuplicateSink = (e: ApiError) => void;
let duplicateSink: DuplicateSink | null = null;
/** The open form sheet shows a duplicate as its own banner instead of a toast; returns the cleanup */
export function setDuplicateSink(fn: DuplicateSink) {
  duplicateSink = fn;
  return () => {
    if (duplicateSink === fn) duplicateSink = null;
  };
}

/** Errors already shown, so a second report (the form's catch after run()) stays silent */
const reported = new WeakSet<object>();

/** Show a failed write once: a toast, or the form sheet's duplicate banner */
export function report(e: unknown) {
  if (typeof e === "object" && e) {
    if (reported.has(e)) return;
    reported.add(e);
  }
  if (!(e instanceof ApiError)) return toast("Bir hata oldu", "error");
  const d = e.duplicate;
  if (d && duplicateSink) return duplicateSink(e);
  if (!d) return toast(e.message, "error");
  const action: ToastAction = d.in_trash
    ? { label: "Geri yükle", run: () => void restore(d.type, d.id).catch(() => {}) }
    : { label: "Kayda git", href: recordHref(d.type, d.id) };
  toast(e.message, "error", action);
}

export async function run<T = unknown>(
  method: "post" | "patch" | "put" | "del",
  path: string,
  body?: unknown,
  opts: {
    ok?: string;
    silent?: boolean;
    /** page of the saved record: the toast gets the check mark and an "Aç" pill */
    open?: string | ((res: Mutation<T>) => string | undefined);
  } = {},
): Promise<Mutation<T> & Record<string, unknown>> {
  try {
    const res = (await (method === "del" ? api.del(path) : api[method](path, body))) as Mutation<T> & Record<string, unknown>;
    const resource = path.split("/")[1];
    invalidate(...(AFFECTS[resource] ?? [`/${resource}`]), ...invalidatesFor(resource));
    const effects = res?.effects?.filter(Boolean) ?? [];
    if (!opts.silent && (opts.ok || effects.length)) {
      const href = typeof opts.open === "function" ? opts.open(res) : opts.open;
      toast([opts.ok, ...effects].filter(Boolean).join(" · "), href ? "saved" : "ok", href ? { label: "Aç", href } : undefined);
    }
    return res ?? {};
  } catch (e) {
    if (!opts.silent) report(e);
    throw e;
  }
}

/** Çöp kutusundan (ya da gizlenen etiket/sektör/kaynağı) geri yükler */
export const restore = (type: string, id: number) => run("post", "/trash/restore", { type, id }, { silent: true }).then((r) => {
  toast(r.effects?.[0] ?? "Geri yüklendi");
  return r;
});

/**
 * Silme: onay sorulmaz, kayıt çöp kutusuna gider ve bildirimde "Geri al" çıkar (Ayarlar > Çöp kutusu'ndan da döner).
 * Hata olursa (ör. bağlı fırsat varken kişi) bildirim run() içinde.
 */
export async function remove(path: string, label: string) {
  const r = await run<never>("del", path, undefined, { silent: true }).catch((e) => {
    report(e);
    throw e;
  });
  const trash = r.trash as { type: string; id: number } | undefined;
  toast(`${label} silindi`, "ok", trash ? { label: "Geri al", run: () => void restore(trash.type, trash.id).catch(() => {}) } : undefined);
  return r;
}
