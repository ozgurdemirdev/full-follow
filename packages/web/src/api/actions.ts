// Yazma işlemleri: API çağrısı + ilgili önbellekleri tazeleme + kısa bildirim
import { PATHS } from "../app/routes";
import { toast, type ToastAction } from "../components/toast";
import { api, ApiError } from "./client";
import { invalidate } from "./store";
import type { Mutation } from "./types";

/** Plan ekranları: günün planı ve takvim (giden temaslar hedeflere kendiliğinden sayılır) */
const PLAN = ["/plan", "/calendar"];
const CONTACTS = ["/people", "/companies", "/today", "/timeline", "/network", "/touches", "/stats", ...PLAN];

/** Her yazma işleminden sonra hangi listelerin tazeleneceği */
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
  projects: ["/projects", "/timeline", "/today", "/payments", "/trash"],
  payments: ["/payments", "/projects", "/today", "/report", "/timeline", "/trash"],
  tasks: ["/tasks", "/today", "/projects", "/timeline", "/trash", ...PLAN],
  goals: ["/goals", "/today", "/timeline", "/trash", ...PLAN],
  drafts: ["/drafts", "/today", "/timeline", "/touches", "/opportunities", "/people", "/companies", "/network", "/templates", "/followups", "/trash"],
  touches: [...CONTACTS, "/opportunities", "/ideas", "/followups", "/trash"],
  comments: ["/comments", "/own-projects", "/today", "/timeline", "/people", "/companies", "/trash"],
  settings: ["/settings", "/report", "/today", "/people", "/network", "/followups"],
  posts: ["/posts", "/today", "/people", "/ideas", "/report", "/trash"],
  templates: ["/templates", "/trash"],
  ideas: ["/ideas", "/own-projects", "/people", "/posts", "/touches", "/timeline", "/trash"],
  "own-projects": ["/own-projects", "/ideas", "/links", "/comments", "/trash"],
  followups: ["/followups", "/drafts", "/today", "/people", "/companies"],
  // geri yükleme her şeyi etkileyebilir
  trash: ["/"],
};

/** Mükerrer kaydın yeri: kişi ve firma kartı, kategoriler Ayarlar'da */
const recordHref = (type: string, id: number) =>
  type === "person" ? `${PATHS.people}/${id}` : type === "company" ? `${PATHS.companies}/${id}` : PATHS.settings;

function failure(e: unknown) {
  if (!(e instanceof ApiError)) return toast("Bir hata oldu", "error");
  const d = e.duplicate;
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
  opts: { ok?: string; silent?: boolean } = {},
): Promise<Mutation<T> & Record<string, unknown>> {
  try {
    const res = (await (method === "del" ? api.del(path) : api[method](path, body))) as Mutation<T> & Record<string, unknown>;
    const resource = path.split("/")[1];
    invalidate(...(AFFECTS[resource] ?? [`/${resource}`]));
    const effects = res?.effects?.filter(Boolean) ?? [];
    if (!opts.silent && (opts.ok || effects.length)) toast([opts.ok, ...effects].filter(Boolean).join(" · "));
    return res ?? {};
  } catch (e) {
    if (!opts.silent) failure(e);
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
    failure(e);
    throw e;
  });
  const trash = r.trash as { type: string; id: number } | undefined;
  toast(`${label} silindi`, "ok", trash ? { label: "Geri al", run: () => void restore(trash.type, trash.id).catch(() => {}) } : undefined);
  return r;
}
