import type { FormEventHandler, ReactNode } from "react";

/** The <form> inside the sheet: the Kaydet button of the footer submits it by id, the fields sit in the two column grid */
export function Form({ id, onSubmit, children }: { id: string; onSubmit: FormEventHandler<HTMLFormElement>; children: ReactNode }) {
  return (
    <form id={id} onSubmit={onSubmit} noValidate className="form-form">
      <div className="form-grid">{children}</div>
    </form>
  );
}

/** A plain line of context inside the grid (what the record is about, a read only fact) */
export function Note({ children }: { children: ReactNode }) {
  return <p className="form-field form-note">{children}</p>;
}
