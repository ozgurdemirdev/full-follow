import { ControlSkeleton } from "@kit/components/settings/Fields";
import { LOCALE } from "@kit/lib/i18n";
import { putSettings, useAutosave, useSettings, type SettingRow } from "@kit/lib/settings";
import { m } from "./messages";

const PINNED_MAX = 4_000;

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

/** The pinned notes row of the "Claude" category */
export const chatNotesRows = (): SettingRow[] => [{
  id: "chat-notes",
  name: m.notes.title,
  hint: m.notes.hint,
  keywords: m.notes.keywords.split("|"),
  wide: true,
  control: <PinnedNotes />,
}];
