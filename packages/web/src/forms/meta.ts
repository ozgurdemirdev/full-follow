// What each form sheet says about itself: names, where the record lands, header icon, and how its edit mode is addressed
import { PATHS, recordPath } from "../app/routes";
import type { SheetKind, SheetState } from "../app/ui";
import { BOARD_ICON } from "../components/boardIcons";
import { FORM_ICON } from "../components/forms/icons";

type Preset = NonNullable<SheetState["preset"]>;

export interface FormMeta {
  /** the type's name in titles and toasts ("Kişi" gives "Kişi ekle" and "Kişi eklendi") */
  noun: string;
  /** one line under the title: where the new record lands */
  dest: string;
  /** path of the header icon */
  icon: string;
  /** api path of the records (also where an edit is read and a delete goes) */
  base: string;
  /** id of the record being edited, read from the opener's preset */
  editId?: (pre: Preset) => number | undefined;
  /** page of a saved record, for the toast's "Aç" pill */
  page: (id: number | undefined, pre?: Preset) => string;
}

const byRecord = (type: string) => (id: number | undefined) => (id ? (recordPath(type, id) ?? PATHS.today) : PATHS.today);
const to = (path: string) => () => path;

export const FORM_META: Record<SheetKind, FormMeta> = {
  person: { noun: "Kişi", dest: "Kişiler’e eklenir", icon: FORM_ICON.userPlus, base: "/people", editId: (p) => p.person_id, page: byRecord("person") },
  company: { noun: "Firma", dest: "Firmalar’a eklenir", icon: BOARD_ICON.building, base: "/companies", editId: (p) => p.edit, page: byRecord("company") },
  opportunity: { noun: "Fırsat", dest: "Satış hunisine eklenir", icon: BOARD_ICON.funnel, base: "/opportunities", editId: (p) => p.edit, page: byRecord("opportunity") },
  touch: { noun: "Temas", dest: "Kişinin zaman çizelgesine eklenir", icon: BOARD_ICON.comment, base: "/touches", editId: (p) => p.edit, page: to(PATHS.timeline) },
  draft: { noun: "Taslak", dest: "Taslaklar’a onay için düşer", icon: BOARD_ICON.pen, base: "/drafts", page: byRecord("draft") },
  offer: {
    noun: "Teklif", dest: "Fırsata bağlanır, aşama Teklif olur", icon: FORM_ICON.offer, base: "/offers", editId: (p) => p.edit,
    page: (_id, pre) => (pre?.opportunity_id ? (recordPath("opportunity", pre.opportunity_id) ?? PATHS.pipeline) : PATHS.pipeline),
  },
  project: { noun: "Proje", dest: "Müşteri projelerine eklenir", icon: BOARD_ICON.folder, base: "/projects", page: byRecord("project") },
  task: { noun: "Görev", dest: "Takvime ve Bugünün planına düşer", icon: FORM_ICON.task, base: "/tasks", editId: (p) => p.edit, page: to(PATHS.calendar) },
  goal: { noun: "Hedef", dest: "Günlük hedeflere eklenir", icon: FORM_ICON.target, base: "/goals", editId: (p) => p.edit, page: to(PATHS.calendar) },
  post: { noun: "Paylaşım", dest: "Paylaşımlar’a eklenir", icon: BOARD_ICON.megaphone, base: "/posts", editId: (p) => p.post_id, page: byRecord("post") },
  idea: { noun: "Fikir", dest: "Gelir fikirlerine eklenir", icon: BOARD_ICON.bulb, base: "/ideas", editId: (p) => p.idea_id, page: byRecord("idea") },
  own_project: { noun: "Kendi projem", dest: "Kendi projelerim’e eklenir", icon: BOARD_ICON.cube, base: "/own-projects", editId: (p) => p.own_project_id, page: byRecord("own_project") },
  template: { noun: "Şablon", dest: "Şablonlar’a eklenir", icon: BOARD_ICON.template, base: "/templates", editId: (p) => p.template_id, page: byRecord("template") },
  comment: { noun: "Yorum", dest: "Yorumlar’a eklenir", icon: BOARD_ICON.comment, base: "/comments", page: byRecord("comment") },
};

/** The record a sheet edits, or null when it adds a new one */
export const editOf = (sheet: SheetState): number | null => FORM_META[sheet.kind].editId?.(sheet.preset ?? {}) ?? null;
