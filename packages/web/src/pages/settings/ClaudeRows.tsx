import { K } from "../../api/keys";
import { useQuery } from "../../api/store";
import type { Today } from "../../api/types";
import { toast } from "../../components/toast";
import { ControlSkeleton } from "../../components/settings/Fields";
import { SetChip, Switch } from "../../components/settings/Parts";
import { ago } from "../../lib/format";
import { putSettings, useAutosave, useSettings, type SettingRow } from "../../lib/settings";

const PINNED_MAX = 4_000;
const LOCKED_TOAST = "Bu kapalı kalır, mesajlar hep senin onayınla gider";

/** Connection line: derived from the latest thing Claude wrote, the same source as the sidebar user block */
function Connection() {
  const today = useQuery<Today>(K.today);
  const at = today.data?.claude_last_at;
  if (!today.data) return today.loading ? <ControlSkeleton /> : null;
  return (
    <span className="set-status" data-on={at ? "" : undefined}>
      <i />
      {at ? `Son istek ${ago(at)}` : "Claude henüz bağlanmadı"}
    </span>
  );
}

/** Rules Claude learned from rejected drafts; deleting one writes the rest back */
function RuleChips() {
  const s = useSettings();
  const rules = s.data?.draft_rules;
  if (!rules) return null;
  if (!rules.length) return <span className="set-row-hint">Henüz öğrendiği kural yok</span>;
  return (
    <span className="set-chips">
      {rules.map((rule, i) => (
        <SetChip key={rule} dot={<i className="set-dot set-dot-accent" />} removeLabel={`${rule} sil`} remove={() => void putSettings({ draft_rules: rules.filter((_, k) => k !== i) }, "Kural silindi").catch(() => {})}>
          {rule}
        </SetChip>
      ))}
    </span>
  );
}

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

export function claudeRows(hasRules: boolean): SettingRow[] {
  return [
    { id: "connection", name: "Bağlantı", hint: "Bilgisayarındaki MCP sunucusu (npm run mcp). Claude’un yazdığı her kayıt “Claude” etiketiyle görünür", keywords: ["mcp", "sunucu", "bağlı"], control: <Connection /> },
    {
      id: "auto-send",
      name: "Taslağı sormadan göndersin",
      hint: "Kapalı kalır: her mesaj senin onayınla gider",
      keywords: ["onay", "gönder", "taslak"],
      control: <Switch label="Taslağı sormadan göndersin" on={false} locked onLockedClick={() => toast(LOCKED_TOAST)} />,
    },
    ...(hasRules
      ? [{ id: "draft-rules", name: "Öğrendiği kurallar", hint: "Sil dersen bir daha uygulamaz", keywords: ["reddet", "öğren", "kural"], wide: true, control: <RuleChips /> }]
      : []),
    {
      id: "chat-notes",
      name: "Sohbet sabit notları",
      hint: "Panel sohbetindeki Claude her konuşmada bu notu da görür. Bir sonraki mesajdan itibaren geçerli olur",
      keywords: ["sohbet", "sabit not", "kural", "bağlam"],
      wide: true,
      control: <PinnedNotes />,
    },
  ];
}
