import { useState } from "react";
import { run } from "@kit/api/actions";
import { PLATFORM } from "@kit/lib/labels";

/** Platform chip in the platform's own colours (R10, LinkedIn, Instagram, Diğer) */
export function PlatformPill({ platform, size }: { platform: string; size?: "lg" }) {
  return <span className="posts-pill" data-platform={platform} data-size={size}>{PLATFORM[platform] ?? platform}</span>;
}

/** "Güncelledim": marks the post as refreshed today; the notification comes from run() */
export function useRefresh(id: number | undefined) {
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    try {
      await run("post", `/posts/${id}/refresh`, undefined, { ok: "Güncellendi olarak işaretlendi" });
    } catch {
      /* the notification is shown inside run() */
    } finally {
      setBusy(false);
    }
  };
  return { busy, refresh };
}
