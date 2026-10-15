import { ControlSkeleton } from "@kit/components/settings/Fields";
import { putSettings, useAutosave, useSettings, type SettingRow } from "@kit/lib/settings";

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
      <textarea className="set-textarea" aria-label="Sohbet sabit notları" maxLength={PINNED_MAX} value={text} onChange={(e) => change(e.target.value)} />
      <span>{text.length.toLocaleString("tr-TR")} / {PINNED_MAX.toLocaleString("tr-TR")}</span>
    </div>
  );
}

/** The pinned notes row of the "Claude" category */
export const chatNotesRows = (): SettingRow[] => [{
  id: "chat-notes",
  name: "Sohbet sabit notları",
  hint: "Panel sohbetindeki Claude her konuşmada bu notu da görür. Bir sonraki mesajdan itibaren geçerli olur",
  keywords: ["sohbet", "sabit not", "kural", "bağlam"],
  wide: true,
  control: <PinnedNotes />,
}];
