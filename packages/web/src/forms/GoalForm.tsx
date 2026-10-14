import { useEffect, useState } from "react";
import { run } from "../api/actions";
import { useQuery } from "../api/store";
import type { Detail, Goal } from "../api/types";
import { NumberField } from "../components/NumberField";
import { Field } from "../components/Sheet";
import { CHANNEL, CHANNELS, GOAL_METRIC, GOAL_PRESETS, WEEKDAY_SHORT } from "../lib/labels";
import { useSubmit, type FormProps } from "./QuickAdd";

const EVERY_DAY = GOAL_PRESETS[0].days;

/** Daily goal: title, per-day target, repeat days, optional automatic counting (a channel or the new records metric), permanent note */
export function GoalForm(p: FormProps) {
  const editId = p.sheet.preset?.edit;
  const existing = useQuery<Detail<Goal>>(editId ? `/goals/${editId}` : null);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<number | null>(10);
  const [days, setDays] = useState<number[]>(EVERY_DAY);
  // what counts by itself: a channel key, a metric key (GOAL_METRIC) or empty for hand entry
  const [auto, setAuto] = useState("");
  const [note, setNote] = useState("");

  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setTitle(row.title);
    setTarget(row.target);
    setDays(row.days.split(",").map(Number));
    setAuto(row.channel ?? row.metric ?? "");
    setNote(row.note ?? "");
  }, [row]);

  const toggle = (n: number) => setDays((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort()));

  const submit = useSubmit(p, async () => {
    const data = { title: title.trim(), target: Number(target), days, channel: auto in GOAL_METRIC ? null : auto || null, metric: auto in GOAL_METRIC ? auto : null, note: note.trim() || null };
    if (editId) await run("patch", `/goals/${editId}`, data, { ok: "Hedef güncellendi" });
    else await run("post", "/goals", data, { ok: "Hedef eklendi" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <Field label="Hedef" htmlFor="g-title">
        <input id="g-title" className="inp" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. LinkedIn bağlantı isteği" />
      </Field>
      <Field label="Günlük sayı" htmlFor="g-target">
        <NumberField id="g-target" className="inp" min={1} required value={target} onChange={setTarget} />
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
        <select id="g-channel" className="inp" value={auto} onChange={(e) => setAuto(e.target.value)}>
          <option value="">Elle gireceğim</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL[c]}: giden mesajlar</option>)}
          {Object.entries(GOAL_METRIC).map(([k, name]) => <option key={k} value={k}>{name}: eklenenler</option>)}
        </select>
      </Field>
      <Field label="Kalıcı not (isteğe bağlı)" htmlFor="g-note">
        <input id="g-note" className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. kişiye özel not yaz" />
      </Field>
    </form>
  );
}
