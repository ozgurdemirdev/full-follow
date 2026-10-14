import { api } from "../../api/client";
import { ACTOR } from "../../lib/labels";
import type { SettingRow } from "../../lib/settings";

const signOut = async () => {
  try {
    await api.post("/logout", {});
  } finally {
    location.reload();
  }
};

/** The "Oturum" row exists only when the password is on (the registry decides) */
export const accountRows = (withSession: boolean): SettingRow[] => [
  { id: "name", name: "Ad", keywords: ["hesap", "kullanıcı"], control: <span className="set-text">{ACTOR.ozgur}</span> },
  ...(withSession
    ? [{
      id: "session",
      name: "Oturum açık",
      hint: "Bu tarayıcıdaki oturum",
      keywords: ["oturum", "çıkış", "şifre"],
      control: <button type="button" className="set-btn" onClick={() => void signOut()}>Çıkış yap</button>,
    }]
    : []),
];
