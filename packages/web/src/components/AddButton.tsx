import { stroke as STROKE } from "../styles/tokens.json";
import { BoardIcon } from "./boardIcons";

/** The accent pill of a page header that adds a record: the plus and its label on one line (the boards' "Kişi ekle") */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="add-pill" onClick={onClick}>
      <BoardIcon name="plus" className="size-icon-md" stroke={STROKE.medium} />
      {label}
    </button>
  );
}
