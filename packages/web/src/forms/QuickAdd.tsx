import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { remove, setDuplicateSink } from "../api/actions";
import type { ApiError } from "../api/client";
import { useQuery } from "../api/store";
import type { Detail } from "../api/types";
import { lazyOf, useRegistry } from "../app/modules/registry";
import type { Lazy } from "../app/modules/types";
import { closeSheet, useUI, type SheetState } from "../app/ui";
import { DuplicateBanner, ErrorSummary } from "../components/forms/Banners";
import { FormErrorsContext } from "../components/forms/context";
import { FormSheet } from "../components/forms/FormSheet";
import { ago } from "../lib/format";
import { ASSIGNEE } from "../lib/labels";
import { m as kit } from "../messages";
import { forms } from "../messages.forms";
import type { FormProps } from "./shared";

const m = forms.quickAdd;

const FORM_ID = "quick-form";

/** Every form that opens from the quick add menu or a page: one sheet, the form of the kind inside (the owning module's quickAdd entry names it) */
export default function QuickAdd() {
  const sheet = useUI((s) => s.sheet);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dup, setDup] = useState<ApiError | null>(null);
  const { quickByKind } = useRegistry();

  // a new sheet starts clean; a duplicate answer of the server becomes the sheet's banner
  useEffect(() => {
    setBusy(false);
    setErrors({});
    setDup(null);
  }, [sheet]);
  useEffect(() => setDuplicateSink(setDup), []);

  const clear = useCallback((name: string) => setErrors(({ [name]: _gone, ...rest }) => rest), []);
  const context = useMemo(() => ({ errors, clear }), [errors, clear]);
  const show = useCallback((next: Record<string, string>) => {
    setErrors(next);
    setDup(null);
  }, []);

  // a kind nobody serves (its module is gone or hidden) opens nothing
  const entry = sheet ? quickByKind.get(sheet.kind) : undefined;
  useEffect(() => {
    if (sheet && !entry) closeSheet();
  }, [sheet, entry]);
  const meta = entry?.form ?? null;
  const editId = sheet && meta ? (meta.editId?.(sheet.preset ?? {}) ?? null) : null;
  const row = useQuery<Detail<{ updated_at: string }>>(meta && editId && !meta.ownRead ? `${meta.base}/${editId}` : null);
  const noun = meta?.noun ?? "";
  const dest = editId && row.data ? m.lastChange(ago(row.data.row.updated_at), row.data.last_actor ? ASSIGNEE[row.data.last_actor] : "") : (meta?.dest ?? "");
  const del = meta && editId ? () => void remove(`${meta.base}/${editId}`, noun).then(closeSheet).catch(() => {}) : undefined;

  return (
    <FormErrorsContext.Provider value={context}>
      <FormSheet
        open={!!sheet && !!entry}
        title={editId ? m.edit(noun) : m.create(noun)}
        icon={meta?.icon ?? ""}
        dest={dest}
        formId={FORM_ID}
        busy={busy}
        saveLabel={busy ? m.saving : editId ? m.saveChanges : kit.save}
        onDelete={del}
        onClose={closeSheet}
        banners={
          <>
            {dup ? <DuplicateBanner error={dup} onOpen={closeSheet} onRestored={() => setDup(null)} /> : null}
            <ErrorSummary count={Object.keys(errors).length} />
          </>
        }
      >
        {sheet && entry ? (
          <Suspense fallback={null}>
            <FormBody key={JSON.stringify(sheet)} sheet={sheet} formId={FORM_ID} setBusy={setBusy} setErrors={show} load={entry.load} />
          </Suspense>
        ) : null}
      </FormSheet>
    </FormErrorsContext.Provider>
  );
}

function FormBody({ load, ...p }: FormProps & { sheet: SheetState; load: Lazy<FormProps> }) {
  const Form = lazyOf(load);
  return <Form {...p} />;
}
