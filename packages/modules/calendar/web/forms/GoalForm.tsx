import { useEffect, useState } from "react";
import { useQuery } from "@kit/api/store";
import type { Detail } from "@kit/api/types";
import { Form } from "@kit/components/forms/Form";
import { ChipsField, MultiChipsField, NumField, TextField } from "@kit/components/forms/fields";
import { CHANNEL, CHANNELS, WEEKDAY_SHORT } from "@kit/lib/labels";
import { errorsOf, saveRecord, useSubmit, type FormProps } from "@kit/forms/shared";
import { GOAL_METRIC, GOAL_PRESETS } from "../labels";
import type { Goal } from "../types";

const EVERY_DAY = GOAL_PRESETS[0].days;
const DEFAULT_TARGET = 10;
const COUNTS = [
  ...CHANNELS.map((c) => ({ value: c, label: `${CHANNEL[c]}: giden mesajlar` })),
  ...Object.entries(GOAL_METRIC).map(([k, name]) => ({ value: k, label: `${name}: eklenenler` })),
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
    () => errorsOf({ title: !title.trim() && "Hedef adı gerekli", target: !(Number(target) >= 1) && "En az 1 olmalı" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="title" label="Hedef adı" req value={title} onChange={setTitle} placeholder="Örn. LinkedIn bağlantı isteği" autoFocus />
      <ChipsField label="Neyi sayar" hint="Seçmezsen sayıyı elle girersin" clearable value={auto} onChange={setAuto} options={COUNTS} />
      <NumField name="target" label="Günde" req half min={1} suffix="adet" value={target} onChange={setTarget} />
      <MultiChipsField label="Tekrar" options={DAYS} value={days} onChange={setDays} />
      <TextField label="Kalıcı not" opt value={note} onChange={setNote} placeholder="Örn. kişiye özel not yaz" />
    </Form>
  );
}
