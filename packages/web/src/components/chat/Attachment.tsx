import { T } from "../../lib/chatText";
import { fmtBytes, isImage } from "../../lib/chatFiles";
import { Icon } from "../icons";

interface Props {
  name: string;
  size: number;
  mime: string;
  /** thumbnail source for images */
  url?: string;
  /** composer previews can be removed; sent ones cannot */
  onRemove?: () => void;
}

/** Image thumbnail or file card (extension and size), as in the design */
export function Attachment({ name, size, mime, url, onRemove }: Props) {
  if (isImage({ mime }) && url && !onRemove) return <img src={url} alt={name} />;
  const remove = onRemove && (
    <button type="button" className="rm" aria-label={T.attachRemove(name)} onClick={onRemove}>
      <Icon name="close" className="size-icon-sm" stroke={2.4} />
    </button>
  );
  if (isImage({ mime }) && url) {
    return (
      <div className="att img" title={name}>
        <img src={url} alt={name} />
        {remove}
      </div>
    );
  }
  return (
    <div className="att">
      <span className="fic">{(name.split(".").pop() || "dosya").slice(0, 4)}</span>
      <span className="fn">
        <b>{name}</b>
        <i>{fmtBytes(size)}</i>
      </span>
      {remove}
    </div>
  );
}
