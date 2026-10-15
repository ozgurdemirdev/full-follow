import { Link } from "wouter";
import type { SettingsCtx } from "@kit/app/modules/types";
import { AutoNumber, ControlSkeleton } from "@kit/components/settings/Fields";
import { lira } from "@kit/lib/format";
import { putSettings, useSettings, type SettingRow } from "@kit/lib/settings";
import { REPORT_PATH } from "./paths";
import { TemplateEditor } from "./settings/TemplateEditor";

type MoneyKey = "bagkur_monthly" | "accounting_monthly" | "other_fixed_monthly" | "target_net_monthly" | "tax_rate_percent";

const MONEY_STEP = 100;
const TAX_MAX = 99;

const MONEY: { field: MoneyKey; name: string; hint: string; keywords?: string[] }[] = [
  { field: "bagkur_monthly", name: "Bağkur", hint: "Aylık", keywords: ["bağ-kur", "sigorta"] },
  { field: "accounting_monthly", name: "Muhasebe", hint: "Aylık", keywords: ["muhasebeci"] },
  { field: "other_fixed_monthly", name: "Diğer sabit giderler", hint: "Aylık: sunucu, yazılım, internet", keywords: ["gider"] },
  { field: "target_net_monthly", name: "Hedeflenen net gelir", hint: "Aylık", keywords: ["hedef", "kazanç"] },
  { field: "tax_rate_percent", name: "Vergi oranı", hint: "Tahsilattan ayrılacak pay", keywords: ["vergi"] },
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
      label={MONEY.find((m) => m.field === field)?.name ?? field}
      min={0}
      max={tax ? TAX_MAX : undefined}
      step={tax ? 1 : MONEY_STEP}
      prefix={tax ? "%" : "₺"}
    />
  );
}

/** The money rows of the business category and the monthly floor they add up to */
export const floorRows = ({ floor }: SettingsCtx): SettingRow[] => [
  ...MONEY.map((m) => ({ id: m.field, name: m.name, hint: m.hint, keywords: m.keywords, control: <FloorField field={m.field} /> })),
  {
    id: "floor",
    name: "Aylık taban",
    hint: `${floor === undefined ? "" : `Şu an ${lira(floor)}. `}Bağkur, muhasebe, sabit gider ve hedef net gelirden, vergi payı eklenerek hesaplanır`,
    keywords: ["fiyat tabanı", "taban", "rapor"],
    control: <Link href={REPORT_PATH} className="set-btn">Rapor’da gör</Link>,
  },
];

/** The payment template: what a won opportunity's project opens its payments with */
export const paymentTemplateRows = (): SettingRow[] => [{
  id: "payment-template",
  name: "Ödeme şablonu",
  hint: "Kazanılan fırsat projeye dönünce ödemeler bu şablona göre açılır. Gün, proje başlangıcından sonraki vade",
  keywords: ["ödeme", "peşinat", "ara ödeme", "teslim", "vade", "yüzde", "aşama"],
  wide: true,
  control: <TemplateEditor />,
}];
