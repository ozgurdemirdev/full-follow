import { moduleVisible } from "@kit/api/modules";
import { useQuery } from "@kit/api/store";
import { ControlSkeleton } from "@kit/components/settings/Fields";
import { SetPills, Switch } from "@kit/components/settings/Parts";
import { LOCALE } from "@kit/lib/i18n";
import { putSettings, useAutosave, useSettings, type SettingRow } from "@kit/lib/settings";
import type { ChatMeta } from "./api";
import { m } from "./messages";

const PINNED_MAX = 4_000;
const META_PATH = "/chat/meta";

/** Text added to every panel chat; the next message of each chat picks it up */
function PinnedNotes() {
  const s = useSettings();
  if (!s.data) return s.loading ? <ControlSkeleton /> : null;
  return <Notes server={s.data.chat_pinned_notes} reload={s.reload} />;
}

function Notes({ server, reload }: { server: string; reload: () => Promise<unknown> }) {
  const [text, change] = useAutosave(server, (v) => putSettings({ chat_pinned_notes: v }), reload);
  return (
    <div className="set-notes">
      <textarea className="set-textarea" aria-label={m.notes.title} maxLength={PINNED_MAX} value={text} onChange={(e) => change(e.target.value)} />
      <span>{text.length.toLocaleString(LOCALE)} / {PINNED_MAX.toLocaleString(LOCALE)}</span>
    </div>
  );
}

/** Background draft runs on or off */
function AutoDraft() {
  const s = useSettings();
  if (!s.data) return s.loading ? <ControlSkeleton /> : null;
  const on = s.data.draft_auto;
  return <Switch label={m.autoDraft.title} on={on} onChange={(v) => void putSettings({ draft_auto: v }, v ? m.autoDraft.on : m.autoDraft.off).catch(() => {})} />;
}

/** The model or the effort of the draft runs, from the lists the chat offers */
function DraftChoice({ field }: { field: "draft_model" | "draft_effort" }) {
  const s = useSettings();
  const meta = useQuery<ChatMeta>(META_PATH).data;
  if (!s.data || !meta) return s.loading ? <ControlSkeleton /> : null;
  const items = (field === "draft_model" ? meta.models : meta.efforts).map((x) => ({ value: x.id, label: x.label }));
  return (
    <SetPills label={field === "draft_model" ? m.autoDraft.model : m.autoDraft.effort} items={items} value={s.data[field]}
      onChange={(v) => void putSettings({ [field]: v }).catch(() => {})} />
  );
}

/** The pinned notes row of the "Claude" category */
export const chatNotesRows = (): SettingRow[] => [{
  id: "chat-notes",
  name: m.notes.title,
  hint: m.notes.hint,
  keywords: m.notes.keywords.split("|"),
  wide: true,
  control: <PinnedNotes />,
}];

/** The auto draft rows of the "Claude" category; only while there are drafts to write */
export const autoDraftRows = (): SettingRow[] => (moduleVisible("drafts") ? [
  { id: "draft-auto", name: m.autoDraft.title, hint: m.autoDraft.hint, keywords: m.autoDraft.keywords.split("|"), control: <AutoDraft /> },
  { id: "draft-model", name: m.autoDraft.model, hint: m.autoDraft.modelHint, keywords: m.autoDraft.keywords.split("|"), control: <DraftChoice field="draft_model" /> },
  { id: "draft-effort", name: m.autoDraft.effort, hint: m.autoDraft.effortHint, keywords: m.autoDraft.keywords.split("|"), control: <DraftChoice field="draft_effort" /> },
] : []);
