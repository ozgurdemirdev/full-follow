import { useEffect } from "react";
import { MIC_ERROR } from "../lib/chatText";
import { useDictation } from "../lib/useDictation";
import { BoardIcon } from "./boardIcons";
import { toast } from "./toast";

const LABEL = { start: "Konuşarak ekle", stop: "Dinlemeyi durdur" };

/** Dictation button (Web Speech API, tr-TR). Each recognised phrase goes to onText; renders nothing when the browser cannot dictate. */
export function MicButton({ onText, className = "" }: { onText: (text: string) => void; className?: string }) {
  const d = useDictation(onText);
  useEffect(() => {
    if (d.error) toast(MIC_ERROR[d.error], "error");
  }, [d.error]);
  if (!d.supported) return null;
  return (
    <button type="button" className={`ff-mic-btn ${className}`} aria-pressed={d.listening} aria-label={d.listening ? LABEL.stop : LABEL.start} onClick={d.toggle}>
      {d.listening ? (
        <span className="ff-mic"><span /><span /><span /></span>
      ) : (
        <BoardIcon name="mic" className="size-icon-md" />
      )}
    </button>
  );
}
