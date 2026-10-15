import { useEffect, useState } from "react";
import { useQuery } from "@kit/api/store";
import type { Detail } from "@kit/api/types";
import { Form } from "@kit/components/forms/Form";
import { ChipsField, MultiChipsField, NumField, TextField } from "@kit/components/forms/fields";
import { CHANNEL, CHANNELS, WEEKDAY_SHORT } from "@kit/lib/labels";
import { errorsOf, saveRecord, useSubmit, type FormProps } from "@kit/forms/shared";
import { GOAL_METRIC, GOAL_PRESETS } from "../labels";
import { m } from "../messages";
import type { Goal } from "../types";

const EVERY_DAY = GOAL_PRESETS[0].days;
const DEFAULT_TARGET = 10;
const COUNTS = [
  ...CHANNELS.map((c) => ({ value: c, label: m.goalForm.countsChannel(CHANNEL[c]) })),
  ...Object.entries(GOAL_METRIC).map(([k, name]) => ({ value: k, label: m.goalForm.countsMetric(name) })),
];
const DAYS = WEEKDAY_SHORT.map((label, i) => ({ value: i + 1, label }));

/** Daily goal: title, per-day target, repeat days, optional automatic counting (a channel or the new records metric), permanent note */
export function GoalForm(p: FormProps) {
  const editId = p.sheet.preset?.edit;
  const existing = useQuery<Detail<Goal>>(editId ? `/goals/${editId}` : null);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<number | null>(DEFAULT_TARGET);
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

  const submit = useSubmit(
    p,
    async () => {
      await saveRecord(p, editId, { title: title.trim(), target: Number(target), days, channel: auto in GOAL_METRIC ? null : auto || null, metric: auto in GOAL_METRIC ? auto : null, note: note.trim() || null });
    },
    () => errorsOf({ title: !title.trim() && m.goalForm.nameRequired, target: !(Number(target) >= 1) && m.goalForm.min }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="title" label={m.goalForm.name} req value={title} onChange={setTitle} placeholder={m.goalForm.namePlaceholder} autoFocus />
      <ChipsField label={m.goalForm.counts} hint={m.goalForm.countsHint} clearable value={auto} onChange={setAuto} options={COUNTS} />
      <NumField name="target" label={m.goalForm.perDay} req half min={1} suffix={m.goalForm.unit} value={target} onChange={setTarget} />
      <MultiChipsField label={m.goalForm.repeat} options={DAYS} value={days} onChange={setDays} />
      <TextField label={m.goalForm.note} opt value={note} onChange={setNote} placeholder={m.goalForm.notePlaceholder} />
    </Form>
  );
}
