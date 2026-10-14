import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { remove, run } from "../../api/actions";
import { openSheet } from "../../app/ui";
import { ANYTIME, KIND, type CalItem, type Kind } from "../../lib/calendar";
import { BoardIcon } from "../boardIcons";
import { EditDelete } from "../contact";
import { MicButton } from "../MicButton";

/** Ticking a task toggles it; ticking a payment records the whole remainder (the payments card of the dashboard does the same) */
function tick(e: CalItem) {
  const t = e.tick;
  if (!t) return;
  if (t.type === "task") void run("patch", `/tasks/${t.id}`, { done: !e.done }, { silent: true }).catch(() => {});
  else void run("post", `/payments/${t.id}/pay`, { amount: t.amount }, { ok: "Ödeme kaydedildi" }).catch(() => {});
}

function ItemRow({ e }: { e: CalItem }) {
  const [more, setMore] = useState(false);
  const taskId = e.tick?.type === "task" ? e.tick.id : null;
  return (
    <div className="flex items-center gap-5 border-t border-border-subtle py-4">
      <button type="button" className="dash-ck" aria-pressed={e.done} disabled={!e.tick} aria-label={`${e.title}${e.done ? ", tamamlandı" : ", tamamla"}`} onClick={() => tick(e)}>
        <BoardIcon name="check" className="size-icon-xs" stroke={2.4} />
      </button>
      <span className="w-dash-time-col flex-none whitespace-nowrap font-mono text-sm text-text-secondary">{e.time ?? ANYTIME}</span>
      <span className={`flex min-w-0 flex-grow flex-col ${e.done ? "opacity-muted" : ""}`}>
        <span className={`text-base ${e.done ? "line-through" : ""}`}>{e.title}</span>
        <span className="flex items-center gap-2 text-sm text-text-secondary">
          <span className={`dash-dot ${KIND[e.kind].dot}`} />{KIND[e.kind].label}{e.extra}
        </span>
      </span>
      {e.href ? <Link href={e.href} className="flex h-dash-pill-height flex-none items-center rounded-pill bg-chip-neutral-bg px-5 text-xs text-chip-neutral-fg">Aç</Link> : null}
      {taskId !== null && more ? <EditDelete label="Görev" onEdit={() => openSheet("task", { edit: taskId })} onDelete={() => void remove(`/tasks/${taskId}`, "Görev").catch(() => {})} /> : null}
      {taskId !== null ? (
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={more} aria-label={`${e.title}: diğer işlemler`} onClick={() => setMore(!more)}>⋯</button>
      ) : null}
    </div>
  );
}

/** Quick add: "14:00 Elif ile görüşme" goes to the core, which reads the time and the kind; dictation fills the same input */
function QuickAdd({ date }: { date: string }) {
  const [text, setText] = useState("");
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const line = text.trim();
    if (!line) return;
    await run("post", "/tasks/quick", { text: line, due_date: date }, { ok: "Plana eklendi" }).then(() => setText("")).catch(() => {});
  };
  return (
    <>
      <form className="cal-add" onSubmit={(ev) => void submit(ev)}>
        <input type="text" value={text} aria-label="Bu güne ekle" placeholder="Bu güne ekle: 14:00 Elif ile görüşme" onChange={(ev) => setText(ev.target.value)} />
        <MicButton onText={(t) => setText((cur) => (cur ? `${cur} ${t}` : t))} />
        <button type="submit" className="cal-add-go" aria-label="Ekle"><BoardIcon name="plus" className="size-icon-chip" stroke={2.4} /></button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 pl-7">
        <span className="text-sm text-text-muted">Saati yazarsan o saate yerleşir, türünü Claude anlar.</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("task", { date })}>Ayrıntılı görev</button>
      </div>
    </>
  );
}

/** The picked day: its items with check off, then the quick add */
export function DayPanel({ title, date, items, hidden }: { title: string; date: string; items: CalItem[]; hidden: ReadonlySet<Kind> }) {
  const done = items.filter((e) => e.done).length;
  const total = items.length;
  return (
    <section key={date} className="cal-day flex flex-col gap-7 rounded-card border border-border-subtle bg-surface-1 p-10" aria-label={title}>
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="m-0 flex-grow text-currency font-light tracking-title">{title}</h2>
        <span className="text-base-sm text-text-secondary">{total ? `${done} / ${total} tamam` : "Plan yok"}</span>
      </div>
      <div className="flex flex-col">
        {items.filter((e) => !hidden.has(e.kind)).map((e) => <ItemRow key={e.key} e={e} />)}
        {!total ? <p className="m-0 border-t border-border-subtle py-6 text-base text-text-muted">Bu gün boş. Yarından devreden işleri buraya çekebilirsin.</p> : null}
      </div>
      <QuickAdd date={date} />
    </section>
  );
}
