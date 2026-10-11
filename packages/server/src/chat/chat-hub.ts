import { Injectable } from "@nestjs/common";
import { CHAT_LIMITS } from "./chat.config";

export interface HubEvent {
  seq: number;
  name: string;
  data: unknown;
}
type Listener = (e: HubEvent) => void;

interface Channel {
  seq: number;
  buffer: HubEvent[];
  listeners: Set<Listener>;
}

/** Latest subscription limit reading, shared by all sessions */
export interface LimitsReading {
  five_hour: number | null;
  seven_day: number | null;
  resets_at: number | null;
  status: string;
  at: string;
}

/** Per session event bus with a ring buffer, so a reconnecting SSE client can replay what it missed */
@Injectable()
export class ChatHub {
  private channels = new Map<number, Channel>();
  limits: LimitsReading | null = null;

  private channel(sessionId: number): Channel {
    let c = this.channels.get(sessionId);
    if (!c) this.channels.set(sessionId, (c = { seq: 0, buffer: [], listeners: new Set() }));
    return c;
  }

  emit(sessionId: number, name: string, data: unknown): HubEvent {
    const c = this.channel(sessionId);
    const e: HubEvent = { seq: ++c.seq, name, data };
    c.buffer.push(e);
    if (c.buffer.length > CHAT_LIMITS.ringBufferEvents) c.buffer.shift();
    for (const l of c.listeners) l(e);
    return e;
  }

  seq(sessionId: number): number {
    return this.channels.get(sessionId)?.seq ?? 0;
  }

  subscribe(sessionId: number, l: Listener): () => void {
    const c = this.channel(sessionId);
    c.listeners.add(l);
    return () => c.listeners.delete(l);
  }

  /** Events after `lastId`, or null when the gap cannot be filled (buffer overflowed, or the server restarted): send a snapshot instead */
  replay(sessionId: number, lastId: number): HubEvent[] | null {
    const c = this.channel(sessionId);
    if (lastId === c.seq) return [];
    if (lastId > c.seq) return null;
    const first = c.buffer[0];
    if (!first || first.seq > lastId + 1) return null;
    return c.buffer.filter((e) => e.seq > lastId);
  }
}
