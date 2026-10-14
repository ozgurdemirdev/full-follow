// Dashboard cards of the posts module (wrappers: the card components still live in the kit and take their data as props)
import type { Today } from "@kit/api/types";
import { PostsDueCard } from "@kit/components/dash/ExtraCards";

export const PostsDueDashCard = ({ today }: { today: Today }) => <PostsDueCard list={today.posts_due!} />;
