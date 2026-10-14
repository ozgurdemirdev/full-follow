import { createContext, useCallback, useContext } from "react";

/** Field errors of the open form sheet, keyed by the fields' `name` */
export interface FormErrors {
  errors: Record<string, string>;
  /** drop one field's error as soon as the user edits it */
  clear: (name: string) => void;
}

export const FormErrorsContext = createContext<FormErrors>({ errors: {}, clear: () => {} });

/** The error line of a field and a wrapper that clears it on change */
export function useFieldError(name?: string) {
  const { errors, clear } = useContext(FormErrorsContext);
  const error = name ? errors[name] : undefined;
  const touch = useCallback(() => {
    if (name && errors[name]) clear(name);
  }, [name, errors, clear]);
  return { error, touch };
}
