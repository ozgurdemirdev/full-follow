import { useMemo } from "react";
import type { Company, CompanyCard } from "@kit/api/types";
import { avatarPair, Skeleton } from "@kit/components/ui";
import { buildStream } from "../stream";
import { CompanyComposer, CompanyStream } from "./CompanyStream";

/** Claude mode of the composer: `id` is the company it was switched on for, `replyTo` the thread being answered (the company overlay keeps it) */
interface ClaudeMode {
  id: number;
  replyTo: number | null;
}

/** The "Temaslar" section of the company overlay (slot "company.overlay.main" of the companies page) */
export function CompanyTouches({ company, card, claude, onClaude }: {
  company: Company;
  card?: CompanyCard;
  claude: ClaudeMode | null;
  onClaude: (m: ClaudeMode | null) => void;
}) {
  const items = useMemo(() => (card ? buildStream(card) : []), [card]);
  return (
    <div className="co-section">
      <h3 className="co-h3">Temaslar</h3>
      <CompanyComposer company={company} card={card} claude={!!claude} replyTo={claude?.replyTo ?? null} onClaude={(next) => onClaude(next ? { id: company.id, replyTo: null } : null)} />
      {card ? <CompanyStream items={items} pair={avatarPair(company.name, company.id)} onReply={(thread) => onClaude({ id: company.id, replyTo: thread })} /> : <Skeleton className="h-chart-height" />}
    </div>
  );
}
