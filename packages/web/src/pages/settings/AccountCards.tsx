import { api } from "../../api/client";
import { useQuery } from "../../api/store";
import { order } from "../../components/ui";

export function SessionCard() {
  const me = useQuery<{ auth: boolean; loggedIn: boolean }>("/me");
  if (!me.data?.auth) return null;
  const out = async () => {
    try {
      await api.post("/logout", {});
    } finally {
      location.reload();
    }
  };
  return (
    <section className="card rise flex items-center gap-5 px-9 py-7" style={order(4)} aria-label="Oturum">
      <span className="flex-grow text-base" data-setting="Oturum açık">Oturum açık</span>
      <button type="button" className="btn btn-sec" onClick={out}>Çıkış yap</button>
    </section>
  );
}
