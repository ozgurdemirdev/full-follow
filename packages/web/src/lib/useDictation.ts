import { useCallback, useEffect, useRef, useState } from "react";
import { dictation } from "../messages.lib";
import { LOCALE } from "./i18n";

// The browser's SpeechRecognition (Chrome, Edge) is not in the TypeScript DOM lib for every target
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Ctor = new () => Recognition;

/** no audio start event for this long counts as stalled */
const STALL_MS = 6_000;
/** Opera exposes the API but has no recognition service behind it: it listens and never returns text */
const noService = () => /OPR\//.test(navigator.userAgent);
const ctor = (): Ctor | undefined => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

/** Why dictation failed, by the code useDictation reports (the texts of the toast and of the chat composer) */
export const MIC_ERROR = dictation;

export interface Dictation {
  supported: boolean;
  listening: boolean;
  /** the phrase still being recognized; replaced by the next result */
  interim: string;
  /** why it failed, or null */
  error: "denied" | "browser" | "insecure" | "network" | "nomic" | "failed" | null;
  /** the microphone opened / speech was heard; `stalled` when nothing arrived for a while (permission prompt ignored, wrong device) */
  heard: "none" | "audio" | "speech";
  stalled: boolean;
  toggle: () => void;
  stop: () => void;
}

/**
 * Dictation into the composer: final phrases go to `onFinal` word by word as they arrive, the unfinished one is exposed as `interim`.
 * Audio goes to the browser vendor's recognition service.
 */
export function useDictation(onFinal: (text: string) => void): Dictation {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<Dictation["error"]>(null);
  const [heard, setHeard] = useState<Dictation["heard"]>("none");
  const [stalled, setStalled] = useState(false);
  const stallTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const rec = useRef<Recognition | null>(null);
  const final = useRef(onFinal);
  useEffect(() => {
    final.current = onFinal;
  });

  const stop = useCallback(() => rec.current?.stop(), []);

  const toggle = useCallback(() => {
    if (rec.current) return rec.current.stop();
    const C = ctor();
    if (!C) return;
    if (noService()) return setError("browser");
    // the browser only opens the microphone on localhost or https
    if (!window.isSecureContext) return setError("insecure");
    const r = new C();
    r.lang = LOCALE;
    r.continuous = true;
    r.interimResults = true;
    r.onaudiostart = () => {
      clearTimeout(stallTimer.current);
      setStalled(false);
      setHeard((h) => (h === "speech" ? h : "audio"));
    };
    r.onspeechstart = () => setHeard("speech");
    r.onresult = (e) => {
      setHeard("speech");
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) final.current(text);
        else pending += text;
      }
      setInterim(pending.trim());
    };
    r.onerror = (e) =>
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied"
          : e.error === "network" ? "network"
            : e.error === "audio-capture" ? "nomic"
              : e.error === "no-speech" || e.error === "aborted" ? null : "failed",
      );
    r.onend = () => {
      clearTimeout(stallTimer.current);
      setStalled(false);
      setHeard("none");
      rec.current = null;
      setListening(false);
      setInterim("");
    };
    rec.current = r;
    setError(null);
    setHeard("none");
    setStalled(false);
    setListening(true);
    stallTimer.current = setTimeout(() => setStalled(true), STALL_MS);
    try {
      r.start();
    } catch {
      rec.current = null;
      clearTimeout(stallTimer.current);
      setListening(false);
      setError("failed");
    }
  }, []);

  // unmount (also a route change): drop the handlers so a late event cannot set state, release the microphone, stop the stall timer
  useEffect(() => () => {
    clearTimeout(stallTimer.current);
    const r = rec.current;
    if (!r) return;
    r.onresult = r.onerror = r.onend = r.onaudiostart = r.onspeechstart = null;
    r.abort();
    rec.current = null;
  }, []);
  return { supported: !!ctor(), listening, interim, error, heard, stalled, toggle, stop };
}
