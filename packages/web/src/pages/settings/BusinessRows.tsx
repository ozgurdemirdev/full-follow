import { Link } from "wouter";
import { PATHS } from "../../app/routes";
import { AutoNumber, ControlSkeleton } from "../../components/settings/Fields";
import { lira } from "../../lib/format";
import { putSettings, useNetworkCfg, useSettings, type SettingRow } from "../../lib/settings";
import { TemplateEditor } from "./TemplateEditor";

type MoneyKey = "bagkur_monthly" | "accounting_monthly" | "other_fixed_monthly" | "target_net_monthly" | "tax_rate_percent";

const MONEY_STEP = 100;
const TAX_MAX = 99;
const TARGET_STEP = 5;

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

/** Weekly outgoing message target; 0 means no target */
function WeeklyTarget() {
  const { cfg, loading, reload } = useNetworkCfg();
  if (!cfg) return loading ? <ControlSkeleton /> : null;
  return <AutoNumber server={cfg.weekly_target || null} save={(n) => putSettings({ weekly_target: n })} settle={reload} label="Haftalık giden mesaj hedefi" nullable min={0} step={TARGET_STEP} placeholder="hedef yok" />;
}

export function businessRows(floor: number | undefined): SettingRow[] {
  return [
    ...MONEY.map((m) => ({ id: m.field, name: m.name, hint: m.hint, keywords: m.keywords, control: <FloorField field={m.field} /> })),
    {
      id: "floor",
      name: "Aylık taban",
      hint: `${floor === undefined ? "" : `Şu an ${lira(floor)}. `}Bağkur, muhasebe, sabit gider ve hedef net gelirden, vergi payı eklenerek hesaplanır`,
      keywords: ["fiyat tabanı", "taban", "rapor"],
      control: <Link href={PATHS.report} className="set-btn">Rapor’da gör</Link>,
    },
    {
      id: "weekly-target",
      name: "Haftalık giden mesaj hedefi",
      hint: "Dashboard’da bu haftanın ilerlemesi görünür. Boş ya da 0 = hedef yok",
      keywords: ["hedef", "linkedin", "mesaj"],
      control: <WeeklyTarget />,
    },
    {
      id: "daily-goals",
      name: "Günlük hedefler",
      hint: "Hedefler Takvim’de eklenir, düzenlenir ve silinir",
      keywords: ["hedef", "plan", "takvim"],
      control: <Link href={PATHS.calendar} className="set-btn">Takvim’e git</Link>,
    },
    {
      id: "payment-template",
      name: "Ödeme şablonu",
      hint: "Kazanılan fırsat projeye dönünce ödemeler bu şablona göre açılır. Gün, proje başlangıcından sonraki vade",
      keywords: ["ödeme", "peşinat", "ara ödeme", "teslim", "vade", "yüzde", "aşama"],
      wide: true,
      control: <TemplateEditor />,
    },
  ];
}
