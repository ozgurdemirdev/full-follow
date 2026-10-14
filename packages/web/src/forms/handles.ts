// Account fields with a fixed lead in the form ("@", "in/", "company/", "https://"): the field shows the name without it, the record keeps the full form
const isUrl = (v: string) => /^https?:\/\//i.test(v);
const COMPANY_PAGE = /^https?:\/\/(?:www\.)?linkedin\.com\/company\/([^/?#]+)/i;

/** Lead shown in front of the field, none when the stored value is a whole address */
export const leadFor = (v: string, lead: string) => (isUrl(v) ? undefined : lead);

export const instagram = {
  show: (v: string | null | undefined) => (v ?? "").replace(/^@/, ""),
  save: (v: string) => (!v.trim() || isUrl(v) ? v.trim() : `@${v.trim().replace(/^@/, "")}`),
};

export const personLinkedin = {
  show: (v: string | null | undefined) => (v ?? "").replace(/^in\//, ""),
  save: (v: string) => v.trim().replace(/^in\//, ""),
};

export const companyLinkedin = {
  show: (v: string | null | undefined) => COMPANY_PAGE.exec(v ?? "")?.[1] ?? (v ?? "").replace(/^company\//, ""),
  save: (v: string) => {
    const t = v.trim().replace(/^company\//, "");
    return !t || isUrl(t) ? t : `https://www.linkedin.com/company/${t}`;
  },
};

export const website = {
  show: (v: string | null | undefined) => (v ?? "").replace(/^https:\/\//i, ""),
  save: (v: string) => v.trim().replace(/^https:\/\//i, ""),
};
