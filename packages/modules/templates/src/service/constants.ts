/** A template with enough sends and a reply rate below this is flagged to be retired */
export const RETIRE_RATE = 0.15;

/** The tip sentences */
export const TIP = {
  unmeasured: "Henüz ölçüm yok. Bir taslakta kullanıp gönderince cevap oranı burada görünür.",
  early: "Gönderimi az olduğu için oranı henüz güvenilir değil.",
  retire: (sent: number, replied: number) => `Bu şablon ${sent} kez gitti, ${replied} cevap aldı.`,
  retireBest: (name: string, rate: string) => ` Aynı tür ve kanalda “${name}” ${rate} cevap alıyor. Bunu arşive kaldırmanı öneririm.`,
  retireAlone: " Bunu arşive kaldırmanı öneririm.",
  leader: (rate: string) => `Aynı tür ve kanalda en yüksek cevap oranı bu şablonda (${rate}).`,
};

export const percent = (rate: number) => `%${Math.round(rate * 100)}`;
