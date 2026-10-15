import { Link } from "wouter";
import { recordHref, restore } from "../../api/actions";
import type { ApiError } from "../../api/client";
import { m as kit } from "../../messages";
import { forms } from "../../messages.forms";
import { FORM_ICON, PathIcon } from "./icons";
import { stroke as STROKE } from "../../styles/tokens.json";

/** Amber "Zaten var" banner: the server refused a duplicate key; the existing record can be opened (or restored from the trash) */
export function DuplicateBanner({ error, onOpen, onRestored }: { error: ApiError; onOpen: () => void; onRestored: () => void }) {
  const d = error.duplicate;
  if (!d) return null;
  return (
    <div className="form-dup" role="alert">
      <span className="form-dup-text">
        <PathIcon d={FORM_ICON.warn} className="size-icon-md" stroke={STROKE.regular} />
        {error.message}
      </span>
      <span className="form-dup-actions">
        {d.in_trash ? (
          <button type="button" data-kind="primary" onClick={() => void restore(d.type, d.id).then(onRestored).catch(() => {})}>{kit.restore}</button>
        ) : (
          <Link href={recordHref(d.type, d.id)} data-kind="primary" onClick={onOpen}>{kit.open}</Link>
        )}
      </span>
    </div>
  );
}

/** One line at the top of a form with errors: how many fields need fixing */
export function ErrorSummary({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div className="form-sum" role="alert">
      <PathIcon d={FORM_ICON.alert} className="size-icon-chip" stroke={STROKE.regular} />
      {forms.banners.fix(count)}
    </div>
  );
}
