import type { SettingRow } from "@kit/lib/settings";
import { TemplateEditor } from "./components/TemplateEditor";

/** The "Ödeme şablonu" row of the business category: the payments a won opportunity opens its project with */
export const paymentTemplateRows = (): SettingRow[] => [{
  id: "payment-template",
  name: "Ödeme şablonu",
  hint: "Kazanılan fırsat projeye dönünce ödemeler bu şablona göre açılır. Gün, proje başlangıcından sonraki vade",
  keywords: ["ödeme", "peşinat", "ara ödeme", "teslim", "vade", "yüzde", "aşama"],
  wide: true,
  control: <TemplateEditor />,
}];
