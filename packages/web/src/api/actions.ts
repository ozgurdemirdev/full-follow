// Yazma işlemleri: API çağrısı + ilgili önbellekleri tazeleme + kısa bildirim
import { currentRegistry, invalidatesFor } from "../app/modules/registry";
import { PATHS } from "../app/routes";
import { toast, type ToastAction } from "../components/toast";
import { m as kit } from "../messages";
import { api as m } from "../messages.api";
import { api, ApiError } from "./client";
import { endpointOn } from "./modules";
import { invalidate } from "./store";
import type { Mutation } from "./types";

/** What a write to an endpoint of a module that is not installed fails with, without a request */
const MODULE_OFF_STATUS = 404;
const MODULE_OFF_CODE = "module_off";

/** Her yazma işleminden sonra hangi listelerin tazeleneceği (modüller kendi verilerini manifest `invalidates` ile ekler) */
const AFFECTS: Record<string, string[]> = {
  sectors: ["/sectors", "/people", "/companies", "/trash"],
  tags: ["/tags", "/people", "/companies", "/trash"],
  notes: ["/notes", "/people", "/trash"],
  links: ["/links", "/own-projects", "/trash"],
  files: ["/opportunities", "/projects", "/trash"],
  sources: ["/sources", "/opportunities", "/people", "/companies", "/trash"],
  comments: ["/comments", "/own-projects", "/today", "/people", "/companies", "/trash"],
  settings: ["/settings", "/today", "/people", "/network"],
  // geri yükleme her şeyi etkileyebilir
  trash: ["/"],
};

/** Mükerrer kaydın yeri: kişi ve firma kartı (modülü sayfasını verir), kategoriler Ayarlar'da */
export const recordHref = (type: string, id: number) => currentRegistry().link(type, id) ?? PATHS.settings;

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
  if (!(e instanceof ApiError)) return toast(m.failed, "error");
  const d = e.duplicate;
  if (d && duplicateSink) return duplicateSink(e);
  if (!d) return toast(e.message, "error");
  const action: ToastAction = d.in_trash
    ? { label: kit.restore, run: () => void restore(d.type, d.id).catch(() => {}) }
    : { label: m.goToRecord, href: recordHref(d.type, d.id) };
  toast(e.message, "error", action);
}

/** Refreshes the lists a write to a resource changes; also for a write the server made by itself (a background draft run) */
export const refreshResource = (resource: string) => invalidate(...(AFFECTS[resource] ?? [`/${resource}`]), ...invalidatesFor(resource));

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
    // the same rule as a read: nothing is sent to an endpoint whose module is not installed
    if (!endpointOn(path)) throw new ApiError(m.moduleOff, MODULE_OFF_STATUS, MODULE_OFF_CODE);
    const res = (await (method === "del" ? api.del(path) : api[method](path, body))) as Mutation<T> & Record<string, unknown>;
    refreshResource(path.split("/")[1]);
    const effects = res?.effects?.filter(Boolean) ?? [];
    if (!opts.silent && (opts.ok || effects.length)) {
      const href = typeof opts.open === "function" ? opts.open(res) : opts.open;
      toast([opts.ok, ...effects].filter(Boolean).join(" · "), href ? "saved" : "ok", href ? { label: kit.open, href } : undefined);
    }
    return res ?? {};
  } catch (e) {
    if (!opts.silent) report(e);
    throw e;
  }
}

/** Çöp kutusundan (ya da gizlenen etiket/sektör/kaynağı) geri yükler */
export const restore = (type: string, id: number) => run("post", "/trash/restore", { type, id }, { silent: true }).then((r) => {
  toast(r.effects?.[0] ?? m.restored);
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
  toast(m.deleted(label), "ok", trash ? { label: kit.undo, run: () => void restore(trash.type, trash.id).catch(() => {}) } : undefined);
  return r;
}
