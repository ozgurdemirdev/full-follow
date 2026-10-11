import { api, ApiError, qs } from "./client";

export type ChatState = "pending" | "streaming" | "done" | "error" | "stopped";
export type ChatPhase = "queued" | "thinking" | "tool" | "writing";

export interface ChatSession {
  id: number;
  title: string;
  model: string;
  effort: string;
  context_tokens: number;
  input_tokens_total: number;
  output_tokens_total: number;
  cost_usd_micros_total: number;
  last_message_at: string | null;
  created_at: string;
}
export interface ChatAttachment {
  id: number;
  name: string;
  size: number;
  mime: string;
  /** browser only: object URL of a file that is not uploaded yet (thumbnail of the bubble being sent) */
  url?: string;
}
export interface ChatAttachmentType {
  ext: string;
  mime: string;
  kind: "image" | "pdf" | "text";
}
export interface ChatMessage {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  body: string;
  state: ChatState;
  client_id: string | null;
  tools_json: string | null;
  error: string | null;
  created_at: string;
  attachments?: ChatAttachment[];
  input_mode?: "text" | "voice";
  /** browser only: a user bubble not yet confirmed by the server */
  local?: "sending" | "failed";
  /** browser only: uploaded file ids to send again on retry */
  attachment_ids?: number[];
}
export interface ChatModel {
  id: string;
  label: string;
  context: number;
}
export interface ChatLimits {
  five_hour: number | null;
  seven_day: number | null;
  five_resets_at: number | null;
  seven_resets_at: number | null;
  status: string;
  at: string;
}
export interface ChatMeta {
  models: ChatModel[];
  efforts: { id: string; label: string }[];
  defaults: { model: string; effort: string };
  attachment_types: ChatAttachmentType[];
  limits: { messagesPageSize: number; sessionsPageSize: number; maxBodyChars: number; haikuPriceStepTokens: number; maxAttachments: number; maxImageBytes: number; maxFileBytes: number };
  cli_ok: boolean;
  cli_error?: "cli_missing" | "mcp_not_built";
  rate_limits: ChatLimits | null;
}
export interface ChatUsage {
  context_tokens: number;
  context_limit: number;
  input_tokens_total: number;
  output_tokens_total: number;
  cost_usd_micros_total: number;
}
export interface ToolRecord {
  name: string;
  summary: string;
  ok: boolean;
  /** an `open` call that worked: the record that was shown */
  open?: { type: string; id: number; label: string };
}

const base = "/chat";
export const chatApi = {
  meta: () => api.get<ChatMeta>(`${base}/meta`),
  sessions: (cursor?: string | null) => api.get<{ items: ChatSession[]; next_cursor: string | null }>(`${base}/sessions${qs({ cursor })}`),
  session: (id: number) => api.get<ChatSession>(`${base}/sessions/${id}`),
  create: (b: { model?: string; effort?: string } = {}) => api.post<ChatSession>(`${base}/sessions`, b),
  update: (id: number, b: { title?: string; model?: string; effort?: string }) => api.patch<ChatSession>(`${base}/sessions/${id}`, b),
  messages: (id: number, before?: number) =>
    api.get<{ items: ChatMessage[]; has_more: boolean; running_message_id: number | null; stream_seq: number }>(`${base}/sessions/${id}/messages${qs({ before })}`),
  send: (id: number, b: { body: string; client_id: string; attachment_ids?: number[]; input_mode?: "text" | "voice" }) =>
    api.post<{ user_message: ChatMessage; assistant_message: ChatMessage | null }>(`${base}/sessions/${id}/messages`, b),
  /** multipart upload; the server sniffs the real type and answers with the stored file */
  upload: async (id: number, file: File): Promise<ChatAttachment> => {
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(`/api${base}/sessions/${id}/attachments`, { method: "POST", body: form, credentials: "same-origin" });
    } catch {
      throw new ApiError("Sunucuya ulaşılamadı", 0, "network");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data?.error ?? res.statusText, res.status, data?.code);
    return data as ChatAttachment;
  },
  attachmentUrl: (id: number) => `/api${base}/attachments/${id}`,
  stop: (id: number) => api.post<{ ok: true }>(`${base}/sessions/${id}/stop`),
  streamUrl: (id: number, lastEventId: number) => `/api${base}/sessions/${id}/stream${qs({ last_event_id: lastEventId })}`,
};

export const parseTools = (m: ChatMessage): ToolRecord[] => {
  try {
    return m.tools_json ? (JSON.parse(m.tools_json) as ToolRecord[]) : [];
  } catch {
    return [];
  }
};
