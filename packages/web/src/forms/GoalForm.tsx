import { useEffect, useState } from "react";
import { run } from "../api/actions";
import { useQuery } from "../api/store";
import type { Detail, Goal } from "../api/types";
import { Field } from "../components/Sheet";
import { CHANNEL, CHANNELS, GOAL_PRESETS, WEEKDAY_SHORT } from "../lib/labels";
import { useSubmit, type FormProps } from "./QuickAdd";

const EVERY_DAY = GOAL_PRESETS[0].days;

/** Daily goal: title, per-day target, repeat days, optional channel for automatic counting, permanent note */
export function GoalForm(p: FormProps) {
  const editId = p.sheet.preset?.edit;
  const existing = useQuery<Detail<Goal>>(editId ? `/goals/${editId}` : null);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("10");
  const [days, setDays] = useState<number[]>(EVERY_DAY);
  const [channel, setChannel] = useState("");
  const [note, setNote] = useState("");

  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setTitle(row.title);
    setTarget(String(row.target));
    setDays(row.days.split(",").map(Number));
    setChannel(row.channel ?? "");
    setNote(row.note ?? "");
  }, [row]);

  const toggle = (n: number) => setDays((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort()));

  const submit = useSubmit(p, async () => {
    const data = { title: title.trim(), target: Number(target), days, channel: channel || null, note: note.trim() || null };
    if (editId) await run("patch", `/goals/${editId}`, data, { ok: "Hedef güncellendi" });
    else await run("post", "/goals", data, { ok: "Hedef eklendi" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <Field label="Hedef" htmlFor="g-title">
        <input id="g-title" className="inp" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. LinkedIn bağlantı isteği" />
      </Field>
      <Field label="Günlük sayı" htmlFor="g-target">
        <input id="g-target" className="inp" type="number" min={1} required value={target} onChange={(e) => setTarget(e.target.value)} />
      </Field>
      <Field label="Tekrar">
        <div className="flex flex-wrap gap-3" role="group" aria-label="Tekrar günleri">
          {WEEKDAY_SHORT.map((name, i) => (
            <button key={name} type="button" aria-pressed={days.includes(i + 1)} className="fchip h-control-height-xs" onClick={() => toggle(i + 1)}>
              {name}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Kendiliğinden say" htmlFor="g-channel">
        <select id="g-channel" className="inp" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">Elle gireceğim</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL[c]}: giden mesajlar</option>)}
        </select>
      </Field>
      <Field label="Kalıcı not (isteğe bağlı)" htmlFor="g-note">
        <input id="g-note" className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. kişiye özel not yaz" />
      </Field>
    </form>
  );
}
