import { useState } from "react";
import { run } from "../../api/actions";
import { K } from "../../api/keys";
import { useQuery } from "../../api/store";
import type { PriceFloor } from "../../api/types";
import { ErrorBox, order, Skeleton } from "../../components/ui";
import { Head } from "./Head";

const PINNED_MAX = 4_000;

export function ChatNotesCard() {
  const s = useQuery<PriceFloor>(K.settings);
  if (s.error && !s.data) return <ErrorBox error={s.error} retry={s.reload} />;
  if (!s.data) return <Skeleton className="h-chart-height" />;
  return <ChatNotes key={`c${s.data.chat_pinned_notes}`} notes={s.data.chat_pinned_notes} />;
}

/** Text added to every panel chat (rules, business context); the next message of each chat picks it up */
function ChatNotes({ notes }: { notes: string }) {
  const [v, setV] = useState(notes);
  const save = () => {
    if (v.trim() === notes) return setV(notes);
    void run("put", "/settings", { chat_pinned_notes: v }, { ok: "Kaydedildi" }).catch(() => setV(notes));
  };
  return (
    <section className="card rise flex flex-col gap-4 px-9 py-8" style={order(2)} aria-label="Sohbet sabit notları">
      <Head title="Sohbet sabit notları" />
      <p className="m-0 text-base-sm text-text-secondary">Panel sohbetindeki Claude her konuşmada bu notu da görür. Bir sonraki mesajdan itibaren geçerli olur.</p>
      <textarea id="set-chat-notes" className="inp min-h-textarea-lg" maxLength={PINNED_MAX} value={v} onChange={(e) => setV(e.target.value)} onBlur={save} aria-label="Sohbet sabit notları" />
      <span className="text-xs text-text-muted">{v.length.toLocaleString("tr-TR")} / {PINNED_MAX.toLocaleString("tr-TR")}</span>
    </section>
  );
}

export function ClaudeCard() {
  return (
    <section className="card rise flex flex-col gap-4 px-9 py-8" style={order(3)} aria-label="Claude bağlantısı">
      <Head title="Claude bağlantısı" />
      <p className="m-0 text-base-sm text-text-secondary">
        Claude bu sisteme yerel MCP sunucusu üzerinden bağlanır, aynı çekirdeği kullanır. Claude’un yazdığı her kayıt “Claude” etiketiyle görünür; taslakları yalnız sen onaylarsın.
      </p>
      <code className="inset px-6 py-5 font-mono text-sm">npm run mcp</code>
    </section>
  );
}
