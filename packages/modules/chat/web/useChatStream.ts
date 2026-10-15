import { useEffect, useRef, useState } from "react";
import { CHAT_UI } from "./constants";

export type Connection = "open" | "lost" | "back";
export type StreamHandler = (name: string, data: any) => void;

const EVENTS = ["status", "delta", "message", "usage", "session", "limits", "navigate", "ack", "snapshot"] as const;

/**
 * One EventSource for the open session. The browser reconnects by itself and sends Last-Event-ID;
 * the first connection gets its position from the `last_event_id` query in the url.
 * `lost` appears only after the connection has been down for lostBadgeMs, `back` shows briefly after it returns.
 */
export function useChatStream(url: string | null, onEvent: StreamHandler): Connection {
  const [conn, setConn] = useState<Connection>("open");
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url, { withCredentials: true });
    let lostTimer: ReturnType<typeof setTimeout> | undefined;
    let backTimer: ReturnType<typeof setTimeout> | undefined;
    let lost = false;

    es.onopen = () => {
      clearTimeout(lostTimer);
      lostTimer = undefined;
      if (!lost) return;
      lost = false;
      setConn("back");
      backTimer = setTimeout(() => setConn("open"), CHAT_UI.backBannerMs);
    };
    es.onerror = () => {
      if (lost || lostTimer) return;
      lostTimer = setTimeout(() => {
        lostTimer = undefined;
        if (es.readyState === EventSource.OPEN) return;
        lost = true;
        clearTimeout(backTimer);
        setConn("lost");
      }, CHAT_UI.lostBadgeMs);
    };
    for (const name of EVENTS) {
      es.addEventListener(name, (e) => handler.current(name, JSON.parse((e as MessageEvent<string>).data)));
    }
    return () => {
      es.close();
      clearTimeout(lostTimer);
      clearTimeout(backTimer);
      setConn("open");
    };
  }, [url]);

  return conn;
}
