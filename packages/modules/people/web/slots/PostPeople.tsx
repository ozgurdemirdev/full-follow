import type { Person, Post } from "@kit/api/types";
import { Section } from "@kit/components/contact";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { Avatar } from "@kit/components/ui";

/** The people a post brought, on the post overlay (the `post.overlay.side` slot of the posts screen) */
export default function PostPeople({ people }: { post: Post; people: Person[] }) {
  return (
    <div className="ppl-panel">
      <Section title={`Kişiler · ${people.length}`}>
        {people.length ? people.map((x) => (
          <RecordLink key={x.id} type="person" id={x.id} className="posts-link-row">
            <Avatar name={x.name} id={x.id} size="sm" />
            <span className="min-w-0 flex-grow truncate text-base">{x.name}</span>
            {x.company_name ? <span className="truncate text-base-sm text-text-muted">{x.company_name}</span> : null}
          </RecordLink>
        )) : <span className="text-base-sm text-text-muted">Bu paylaşımdan kimse gelmedi</span>}
      </Section>
    </div>
  );
}
