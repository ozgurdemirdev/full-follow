import { Fragment, useEffect, useRef } from "react";
import type { ChatSession } from "../api";
import { fmtDay } from "@kit/lib/format";
import { T } from "../messages";
import { Icon } from "@kit/components/icons";

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
const timeFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

const stampOf = (s: ChatSession) => s.last_message_at ?? s.created_at;

function group(s: ChatSession): string {
  const age = (Date.now() - new Date(stampOf(s)).getTime()) / DAY_MS;
  if (new Date(stampOf(s)).toDateString() === new Date().toDateString()) return T.groupToday;
  return age < WEEK_DAYS ? T.groupWeek : T.groupOlder;
}

function when(s: ChatSession): string {
  const d = new Date(stampOf(s));
  return d.toDateString() === new Date().toDateString() ? timeFmt.format(d) : fmtDay(stampOf(s));
}

interface Props {
  sessions: ChatSession[];
  currentId: number | null;
  runningId: number | null;
  hasMore: boolean;
  loadMore: () => void;
  onPick: (id: number) => void;
  onNew: () => void;
}

export function SessionList({ sessions, currentId, runningId, hasMore, loadMore, onPick, onNew }: Props) {
  const end = useRef<HTMLDivElement>(null);
  // the observer is rebuilt when a page has landed (a sentinel still in view asks for the next one) and never because the callback is new:
  // a rebuilt observer reports a visible sentinel at once, which asked for the same page again
  const more = useRef(loadMore);
  useEffect(() => {
    more.current = loadMore;
  });
  useEffect(() => {
    const s = end.current;
    if (!s || !hasMore) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && more.current());
    io.observe(s);
    return () => io.disconnect();
  }, [hasMore, sessions.length]);

  let last = "";
  return (
    <aside className="sess" aria-label={T.sessions}>
      <div className="sess-head"><span>{T.sessions}</span></div>
      <button className="newbtn" type="button" onClick={onNew}>
        <Icon name="plus" className="size-icon-md" />
        {T.newChat}
      </button>
      <div className="sess-list">
        {sessions.map((s) => {
          const g = group(s);
          const head = g !== last;
          last = g;
          return (
            <Fragment key={s.id}>
              {head && <div className="sess-group">{g}</div>}
              <button type="button" className="sitem" aria-current={s.id === currentId ? "true" : undefined} onClick={() => onPick(s.id)}>
                {s.id === runningId && <i className="live" aria-label={T.live} />}
                <span>{s.title}</span>
                <time>{when(s)}</time>
              </button>
            </Fragment>
          );
        })}
        {hasMore && <div ref={end} className="sess-more">{T.sessionsMore}</div>}
      </div>
    </aside>
  );
}
