import { Link } from "wouter";
import { BoardIcon } from "../boardIcons";

/** Link with the arrow circle that sits in the header of a dashboard card */
export function MoreLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="ff-more">
      {children}
      <span className="ff-more-ic"><BoardIcon name="expand" className="size-icon-chip" stroke={2.2} /></span>
    </Link>
  );
}
