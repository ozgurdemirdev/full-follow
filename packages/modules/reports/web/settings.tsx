import { Link } from "wouter";
import type { SettingsCtx } from "@kit/app/modules/types";
import { AutoNumber, ControlSkeleton } from "@kit/components/settings/Fields";
import { lira } from "@kit/lib/format";
import { putSettings, useSettings, type SettingRow } from "@kit/lib/settings";
import { MONEY_STEP, TAX_MAX } from "./constants";
import { m } from "./messages";
import { REPORT_PATH } from "./paths";
import { TemplateEditor } from "./settings/TemplateEditor";

type MoneyKey = "bagkur_monthly" | "accounting_monthly" | "other_fixed_monthly" | "target_net_monthly" | "tax_rate_percent";

const MONEY: { field: MoneyKey; name: string; hint: string; keywords?: string[] }[] = [
  { field: "bagkur_monthly", name: m.settings.bagkur, hint: m.settings.monthly, keywords: m.settingsKeywords.bagkur.split(",") },
  { field: "accounting_monthly", name: m.settings.accounting, hint: m.settings.monthly, keywords: m.settingsKeywords.accounting.split(",") },
  { field: "other_fixed_monthly", name: m.settings.otherFixed, hint: m.settings.monthlyOther, keywords: m.settingsKeywords.otherFixed.split(",") },
  { field: "target_net_monthly", name: m.settings.targetNet, hint: m.settings.monthly, keywords: m.settingsKeywords.targetNet.split(",") },
  { field: "tax_rate_percent", name: m.settings.taxRate, hint: m.settings.taxHint, keywords: m.settingsKeywords.taxRate.split(",") },
];

/** One stepper of the price floor; every one reads the same settings entry */
function FloorField({ field }: { field: MoneyKey }) {
  const s = useSettings();
  if (!s.data) return s.loading ? <ControlSkeleton /> : null;
  const tax = field === "tax_rate_percent";
  return (
    <AutoNumber
      server={s.data[field]}
      save={(n) => putSettings({ [field]: n })}
      settle={s.reload}
      label={MONEY.find((x) => x.field === field)?.name ?? field}
      min={0}
      max={tax ? TAX_MAX : undefined}
      step={tax ? 1 : MONEY_STEP}
      prefix={tax ? m.shared.percent : m.shared.currency}
    />
  );
}

/** The money rows of the business category and the monthly floor they add up to */
export const floorRows = ({ floor }: SettingsCtx): SettingRow[] => [
  ...MONEY.map((x) => ({ id: x.field, name: x.name, hint: x.hint, keywords: x.keywords, control: <FloorField field={x.field} /> })),
  {
    id: "floor",
    name: m.settings.floorName,
    hint: m.settings.floorHint(floor === undefined ? undefined : lira(floor)),
    keywords: m.settingsKeywords.floor.split(","),
    control: <Link href={REPORT_PATH} className="set-btn">{m.settings.seeInReport}</Link>,
  },
];

/** The payment template: what a won opportunity's project opens its payments with */
export const paymentTemplateRows = (): SettingRow[] => [{
  id: "payment-template",
  name: m.settings.templateName,
  hint: m.settings.templateHint,
  keywords: m.settingsKeywords.paymentTemplate.split(","),
  wide: true,
  control: <TemplateEditor />,
}];
