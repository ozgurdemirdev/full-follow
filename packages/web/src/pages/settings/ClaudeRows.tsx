import { K } from "../../api/keys";
import { useQuery } from "../../api/store";
import type { Today } from "../../api/types";
import { ControlSkeleton } from "../../components/settings/Fields";
import { ago } from "../../lib/format";
import { words, type SettingRow } from "../../lib/settings";
import { settings } from "../../messages.settings";

const m = settings.claude;

/** Connection line: derived from the latest thing Claude wrote, the same source as the sidebar user block */
function Connection() {
  const today = useQuery<Today>(K.today);
  const at = today.data?.claude_last_at;
  if (!today.data) return today.loading ? <ControlSkeleton /> : null;
  return (
    <span className="set-status" data-on={at ? "" : undefined}>
      <i />
      {at ? m.lastRequest(ago(at)) : m.never}
    </span>
  );
}

/** The kit's row of the "Claude" category; the modules add theirs (drafts: sending without asking and the learned rules, chat: the pinned notes) */
export function claudeRows(): SettingRow[] {
  return [
    { id: "connection", name: m.connection, hint: m.connectionHint, keywords: words(m.connectionKeywords), control: <Connection /> },
  ];
}
