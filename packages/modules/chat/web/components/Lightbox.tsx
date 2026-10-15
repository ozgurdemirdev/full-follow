import { useEffect } from "react";
import { createPortal } from "react-dom";
import { T } from "../chatText";
import { Icon } from "@kit/components/icons";

/** Full size view of an image attachment: click outside, the close button or Esc closes it (Esc does not minimize the chat behind it) */
export function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", esc, true);
    return () => document.removeEventListener("keydown", esc, true);
  }, [onClose]);

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
      <button type="button" className="lightbox-close" aria-label={T.close} onClick={onClose}>
        <Icon name="close" className="size-icon-lg" stroke={2} />
      </button>
      <img src={url} alt={name} onClick={(e) => e.stopPropagation()} />
      <span className="lightbox-name">{name}</span>
    </div>,
    document.body,
  );
}
