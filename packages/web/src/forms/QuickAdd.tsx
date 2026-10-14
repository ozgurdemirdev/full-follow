import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { remove, setDuplicateSink } from "../api/actions";
import type { ApiError } from "../api/client";
import { useQuery } from "../api/store";
import type { Detail } from "../api/types";
import { closeSheet, useUI, type SheetKind, type SheetState } from "../app/ui";
import { DuplicateBanner, ErrorSummary } from "../components/forms/Banners";
import { FormErrorsContext } from "../components/forms/context";
import { FormSheet } from "../components/forms/FormSheet";
import { ago } from "../lib/format";
import { ASSIGNEE } from "../lib/labels";
import { editOf, FORM_META } from "./meta";
import type { FormProps } from "./shared";

const FORM_ID = "quick-form";
const forms = {
  opportunity: lazy(() => import("./OpportunityForm").then((m) => ({ default: m.OpportunityForm }))),
  task: lazy(() => import("./TaskForms").then((m) => ({ default: m.TaskForm }))),
  comment: lazy(() => import("./TaskForms").then((m) => ({ default: m.CommentForm }))),
  draft: lazy(() => import("./MarketingForms").then((m) => ({ default: m.DraftForm }))),
  post: lazy(() => import("./MarketingForms").then((m) => ({ default: m.PostForm }))),
  idea: lazy(() => import("./MarketingForms").then((m) => ({ default: m.IdeaForm }))),
  template: lazy(() => import("./MarketingForms").then((m) => ({ default: m.TemplateForm }))),
  person: lazy(() => import("./ContactForms").then((m) => ({ default: m.PersonForm }))),
  company: lazy(() => import("./ContactForms").then((m) => ({ default: m.CompanyForm }))),
  touch: lazy(() => import("./ContactForms").then((m) => ({ default: m.TouchForm }))),
  goal: lazy(() => import("./GoalForm").then((m) => ({ default: m.GoalForm }))),
  own_project: lazy(() => import("./OwnProjectForm").then((m) => ({ default: m.OwnProjectForm }))),
  project: lazy(() => import("./ProjectForm").then((m) => ({ default: m.ProjectForm }))),
  offer: lazy(() => import("../components/OfferForm").then((m) => ({ default: m.OfferForm }))),
} satisfies Record<SheetKind, unknown>;

/** Every form that opens from the quick add menu or a page: one sheet, the form of the kind inside */
export default function QuickAdd() {
  const sheet = useUI((s) => s.sheet);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dup, setDup] = useState<ApiError | null>(null);

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

  const meta = sheet ? FORM_META[sheet.kind] : null;
  const editId = sheet ? editOf(sheet) : null;
  const row = useQuery<Detail<{ updated_at: string }>>(meta && editId && sheet?.kind !== "offer" ? `${meta.base}/${editId}` : null);
  const noun = meta?.noun ?? "";
  const dest = editId && row.data ? `Son değişiklik ${ago(row.data.row.updated_at)}${row.data.last_actor ? ` · ${ASSIGNEE[row.data.last_actor]}` : ""}` : (meta?.dest ?? "");
  const del = meta && editId ? () => void remove(`${meta.base}/${editId}`, noun).then(closeSheet).catch(() => {}) : undefined;

  return (
    <FormErrorsContext.Provider value={context}>
      <FormSheet
        open={!!sheet}
        title={`${noun} ${editId ? "düzenle" : "ekle"}`}
        icon={meta?.icon ?? ""}
        dest={dest}
        formId={FORM_ID}
        busy={busy}
        saveLabel={busy ? "Kaydediliyor" : editId ? "Değişiklikleri kaydet" : "Kaydet"}
        onDelete={del}
        onClose={closeSheet}
        banners={
          <>
            {dup ? <DuplicateBanner error={dup} onOpen={closeSheet} onRestored={() => setDup(null)} /> : null}
            <ErrorSummary count={Object.keys(errors).length} />
          </>
        }
      >
        {sheet ? (
          <Suspense fallback={null}>
            <FormBody key={JSON.stringify(sheet)} sheet={sheet} formId={FORM_ID} setBusy={setBusy} setErrors={show} />
          </Suspense>
        ) : null}
      </FormSheet>
    </FormErrorsContext.Provider>
  );
}

function FormBody(p: FormProps & { sheet: SheetState }) {
  const Form = forms[p.sheet.kind];
  return <Form {...p} />;
}
