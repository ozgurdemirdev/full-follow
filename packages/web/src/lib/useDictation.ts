import { useCallback, useEffect, useRef, useState } from "react";

// The browser's SpeechRecognition (Chrome, Edge) is not in the TypeScript DOM lib for every target
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type Ctor = new () => Recognition;

const LANG = "tr-TR";
const ctor = (): Ctor | undefined => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export interface Dictation {
  supported: boolean;
  listening: boolean;
  /** the phrase still being recognized; replaced by the next result */
  interim: string;
  /** error key of the last failure: "denied" | "failed" | null */
  error: "denied" | "failed" | null;
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
    const r = new C();
    r.lang = LANG;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) final.current(text);
        else pending += text;
      }
      setInterim(pending.trim());
    };
    r.onerror = (e) => setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : e.error === "no-speech" || e.error === "aborted" ? null : "failed");
    r.onend = () => {
      rec.current = null;
      setListening(false);
      setInterim("");
    };
    rec.current = r;
    setError(null);
    setListening(true);
    r.start();
  }, []);

  useEffect(() => () => rec.current?.stop(), []);
  return { supported: !!ctor(), listening, interim, error, toggle, stop };
}
