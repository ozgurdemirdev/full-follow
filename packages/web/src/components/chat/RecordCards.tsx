import { useCallback, useEffect, useRef, useState } from "react";
import { run } from "../../api/actions";
import { chatApi, type CardRecord } from "../../api/chat";
import { toast } from "../toast";
import { fmtDay, pct, tl } from "../../lib/format";
import { cardKey, parseCards, type CardGroup, type CardItem } from "../../lib/chatReply";
import { T } from "../../lib/chatText";
import { CHANNEL, CONTACT_STATUS, IDEA_STAGE, MILESTONE, PLATFORM, STAGE, TEMPLATE_KIND } from "../../lib/labels";
import { useOpenRecord } from "../../lib/openRecord";
import { Icon } from "../icons";

const DOT: Record<string, string> = {
  task: "var(--color-accent-task)", goal: "var(--color-accent-payment)", person: "var(--color-accent-person)", company: "var(--color-accent-company)",
  opportunity: "var(--color-accent-opportunity)", draft: "var(--color-primary)", template: "var(--color-accent-source)", idea: "var(--color-accent-payment)",
  payment: "var(--color-accent-payment)", post: "var(--color-accent-warning)", comment: "var(--color-accent-comment)",
};

/** One request per block, kept per message so scrolling and re-renders do not fetch again; reopening a session fetches fresh rows */
const cache = new Map<string, CardRecord[]>();

function useRecords(cacheKey: string, keys: string[]) {
  const [rows, setRows] = useState<CardRecord[] | null>(() => cache.get(cacheKey) ?? null);
  const joined = keys.join(",");
  const load = useCallback(async () => {
    const r = await chatApi.records(joined.split(","));
    cache.set(cacheKey, r);
    setRows(r);
  }, [cacheKey, joined]);
  useEffect(() => {
    if (!cache.has(cacheKey)) void load().catch(() => setRows([]));
  }, [cacheKey, load]);
  return { rows, reload: load };
}

const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

function metaOf(r: CardRecord): string {
  switch (r.type) {
    case "task": return r.due_date ? fmtDay(r.due_date) : "";
    case "goal": return `${r.done} / ${r.target}`;
    case "person": return join(r.role, r.company, CONTACT_STATUS[r.status]);
    case "company": return CONTACT_STATUS[r.status] ?? "";
    case "opportunity": return join(STAGE[r.stage as keyof typeof STAGE], r.value ? tl(r.value) : null, r.person);
    case "draft": return join(CHANNEL[r.channel], r.status === "bekliyor" ? T.draftWaiting : r.status === "gonderildi" ? T.draftSent : r.status === "onaylandi" ? "Onaylandı" : "Reddedildi");
    case "idea": return IDEA_STAGE[r.stage] ?? "";
    case "payment": return join(MILESTONE[r.milestone], tl(r.expected), r.due_date ? fmtDay(r.due_date) : null);
    case "post": return PLATFORM[r.platform] ?? "";
    case "comment": return r.target_label ?? "";
    default: return "";
  }
}

function Row({ r, reload }: { r: CardRecord; reload: () => Promise<void> }) {
  const open = useOpenRecord();
  const [busy, setBusy] = useState(false);
  const go = () => (r.type === "payment" ? open("project", r.project_id) : open(r.type, r.id));
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch {
      /* the notification is shown by run() */
    } finally {
      setBusy(false);
    }
  };
  const sendable = r.type === "draft" && r.status === "onaylandi";
  return (
    <div className="rc-row" data-done={r.done || r.resolved ? "" : undefined}>
      {r.type === "task" ? (
        <button
          type="button"
          className="rc-chk"
          role="checkbox"
          aria-checked={!!r.done}
          aria-label={T.taskDone(r.title)}
          disabled={busy}
          onClick={() => void act(() => run("patch", `/tasks/${r.id}`, { done: !r.done }, { silent: true }))}
        >
          <Icon name="check" className="size-icon-sm" stroke={2.6} />
        </button>
      ) : (
        <span className="rc-dot" style={{ background: DOT[r.type] }} />
      )}
      <button type="button" className="rc-main" onClick={go}>
        <b>{r.title}</b>
        <span>{metaOf(r)}</span>
      </button>
      {r.type === "goal" && (
        <div className="rc-goal" aria-label={pct(r.target ? r.done / r.target : 0)}>
          <i style={{ width: `${Math.max(2, Math.min(100, r.target ? (r.done / r.target) * 100 : 0))}%` }} />
        </div>
      )}
      {r.type === "person" && r.draft_id && (
        <button type="button" className="rc-act" onClick={() => open("draft", r.draft_id)}>{T.draftOpen}</button>
      )}
      {sendable && (
        <button type="button" className="rc-act" disabled={busy} onClick={() => void act(() => run("post", `/drafts/${r.id}/send`, undefined, { ok: T.draftSent }))}>
          {T.draftSent}
        </button>
      )}
    </div>
  );
}

const PLACEHOLDER = /(\{[\p{L}\w]+\})/u;

/** The stored text, filled for the person with the same fill the follow-up drafts use; empty placeholders stay marked so they are not sent by mistake */
function TemplateCard({ r }: { r: CardRecord }) {
  const open = useOpenRecord();
  const [view, setView] = useState<"filled" | "raw">(r.filled ? "filled" : "raw");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const bodyRef = useRef<HTMLPreElement>(null);
  const text: string = view === "filled" && r.filled ? r.filled : r.body;
  const stats = r.sent ? T.tplStats(r.sent, r.replied, pct(r.reply_rate)) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_600);
    } catch {
      const sel = getSelection();
      if (bodyRef.current && sel) {
        const range = document.createRange();
        range.selectNodeContents(bodyRef.current);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      toast(T.tplSelected);
    }
  };
  const save = async () => {
    try {
      await run("post", "/drafts", { person_id: r.person_id, channel: r.channel ?? "email", body: r.filled ?? r.body, template_id: r.id }, { ok: T.tplSaved });
      setSaved(true);
    } catch {
      /* the notification is shown by run() */
    }
  };
  return (
    <div className="rc-tpl">
      <div className="rc-tpl-head">
        <span className="rc-dot" style={{ background: DOT.template }} />
        <button type="button" className="rc-main" onClick={() => open("template", r.id)}>
          <b>{r.title}</b>
          <span>{join(TEMPLATE_KIND[r.kind], r.channel && CHANNEL[r.channel], stats, r.for_name && T.tplFor(r.for_name))}</span>
        </button>
      </div>
      <pre className="rc-tpl-body" ref={bodyRef}>
        {text.split(PLACEHOLDER).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))}
      </pre>
      <div className="rc-tpl-foot">
        {r.filled && (
          <div className="cseg" role="radiogroup" aria-label={T.tplView}>
            <button type="button" role="radio" aria-checked={view === "filled"} onClick={() => setView("filled")}>{T.tplFilled}</button>
            <button type="button" role="radio" aria-checked={view === "raw"} onClick={() => setView("raw")}>{T.tplRaw}</button>
          </div>
        )}
        <span className="sp" />
        {r.person_id && (
          <button type="button" className="rc-act" disabled={saved} onClick={() => void save()}>{saved ? T.tplSaved : T.tplSave}</button>
        )}
        <button type="button" className="rc-act pri" onClick={() => void copy()}>{copied ? T.tplCopied : T.tplCopy}</button>
      </div>
    </div>
  );
}

function Group({ group, rows, reload }: { group: CardGroup; rows: Map<string, CardRecord>; reload: () => Promise<void> }) {
  return (
    <div className="rc-group">
      {group.label && <div className="rc-label">{group.label}</div>}
      {group.items.map((item: CardItem) => {
        const key = cardKey(item);
        const r = rows.get(key);
        if (!r) return null;
        if (r.missing) return <div key={key} className="rc-miss">{T.cardMissing(key)}</div>;
        return r.type === "template" ? <TemplateCard key={key} r={r} /> : <Row key={key} r={r} reload={reload} />;
      })}
    </div>
  );
}

/** ```ff-cards block of a reply: live rows of the panel, same look as the dashboard rows */
export function RecordCards({ source, messageId }: { source: string; messageId: number }) {
  const groups = parseCards(source);
  const keys = groups ? groups.flatMap((g) => g.items.map(cardKey)) : [];
  const { rows, reload } = useRecords(`${messageId}:${keys.join(",")}`, keys);
  if (!groups || !keys.length) return null;
  if (!rows) return <div className="rc-skel">{T.cardsLoading}</div>;
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return (
    <div className="rc">
      {groups.map((g, i) => <Group key={i} group={g} rows={byKey} reload={reload} />)}
    </div>
  );
}

/** Shown while the closing fence has not arrived yet */
export function CardsSkeleton() {
  return <div className="rc-skel">{T.cardsLoading}</div>;
}
