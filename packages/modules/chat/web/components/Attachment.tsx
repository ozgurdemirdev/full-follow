import { useState } from "react";
import { T } from "../messages";

import { fmtBytes, isImage } from "../chatFiles";
import { Icon } from "@kit/components/icons";
import { Lightbox } from "./Lightbox";
import { stroke as STROKE } from "@kit/styles/tokens.json";

interface Props {
  name: string;
  size: number;
  mime: string;
  /** thumbnail source for images (also what the full size view shows) */
  url?: string;
  /** where a non-image file opens (a new tab); called on click so a preview can create its object URL lazily */
  openUrl?: () => string;
  /** composer previews can be removed; sent ones cannot */
  onRemove?: () => void;
}

/** Image thumbnail or file card (extension and size), as in the design. An image opens full size, a file opens in a new tab. */
export function Attachment({ name, size, mime, url, openUrl, onRemove }: Props) {
  const [big, setBig] = useState(false);
  const image = isImage({ mime }) && !!url;
  const open = () => {
    if (image) setBig(true);
    else if (openUrl) window.open(openUrl(), "_blank", "noopener");
  };
  const remove = onRemove && (
    <button type="button" className="rm" aria-label={T.attachRemove(name)} onClick={onRemove}>
      <Icon name="close" className="size-icon-sm" stroke={STROKE.bold} />
    </button>
  );
  const lightbox = big && url && <Lightbox url={url} name={name} onClose={() => setBig(false)} />;

  if (image && !onRemove) {
    return (
      <>
        <button type="button" className="att-open" aria-label={T.attachOpen(name)} onClick={open}>
          <img src={url} alt={name} />
        </button>
        {lightbox}
      </>
    );
  }
  if (image) {
    return (
      <div className="att img" title={name}>
        <button type="button" className="att-open" aria-label={T.attachOpen(name)} onClick={open}>
          <img src={url} alt={name} />
        </button>
        {remove}
        {lightbox}
      </div>
    );
  }
  return (
    <div className="att" data-openable={openUrl ? "" : undefined}>
      <button type="button" className="att-open att-card" aria-label={T.attachOpen(name)} disabled={!openUrl} onClick={open}>
        <span className="fic">{(name.split(".").pop() || "dosya").slice(0, 4)}</span>
        <span className="fn">
          <b>{name}</b>
          <i>{fmtBytes(size)}</i>
        </span>
      </button>
      {remove}
    </div>
  );
}
