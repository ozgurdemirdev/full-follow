import { IDEA_STAGES, keptRows, type Ctx, type IdeaStats, type InterestRow } from "@fullfollow/core";
import { judge } from "./verdict";

/**
 * Fikir listesi + ilgi ölçümü: kaç kişiye anlatıldı, kaçı ilgilendi, oran; hedef sektörler; temas ve paylaşım sayısı.
 * The touches, posts, people and own projects tables are read directly: they always exist.
 */
export function ideaStats(ctx: Ctx): IdeaStats[] {
  const secs = keptRows<{ idea_id: number; id: number; path: string }>(ctx, `
    SELECT x.idea_id, s.id, CASE WHEN p.name IS NULL THEN s.name ELSE p.name || ' > ' || s.name END AS path
    FROM idea_sectors x JOIN sectors s ON s.id = x.sector_id LEFT JOIN sectors p ON p.id = s.parent_id ORDER BY path`);
  return keptRows(ctx, `
    SELECT i.*,
      (SELECT COUNT(*) FROM idea_people x WHERE x.idea_id = i.id) AS told,
      (SELECT COUNT(*) FROM idea_people x WHERE x.idea_id = i.id AND x.interest = 'ilgilendi') AS interested,
      (SELECT COUNT(*) FROM idea_people x WHERE x.idea_id = i.id AND x.interest = 'ilgilenmedi') AS not_interested,
      (SELECT COUNT(*) FROM touches t WHERE t.idea_id = i.id) AS touch_count,
      (SELECT COUNT(*) FROM posts p WHERE p.idea_id = i.id) AS post_count,
      (SELECT COUNT(*) FROM people x JOIN posts p ON p.id = x.post_id WHERE p.idea_id = i.id) AS post_people,
      (SELECT title FROM ideas pa WHERE pa.id = i.parent_id) AS parent_title,
      (SELECT name FROM own_projects o WHERE o.id = i.own_project_id) AS own_project_title,
      (SELECT COUNT(*) FROM ideas c WHERE c.parent_id = i.id) AS child_count
    FROM ideas i ORDER BY i.updated_at DESC, i.id DESC`)
    .map((i): IdeaStats => {
      const s = secs.filter((x) => x.idea_id === i.id);
      return { ...i, sectors: s.map((x) => ({ id: x.id, path: x.path })), interest_rate: i.told ? i.interested / i.told : null, ...judge(i) };
    })
    .sort((a, b) => IDEA_STAGES.indexOf(b.stage) - IDEA_STAGES.indexOf(a.stage) || b.updated_at.localeCompare(a.updated_at));
}

/** Bir fikre bağlı kişiler (ilgisiyle) */
export function ideaPeople(ctx: Ctx, ideaId?: number, personId?: number): InterestRow[] {
  return keptRows(ctx, `
    SELECT x.*, p.name AS person_name, c.name AS company_name, i.title AS idea_title, i.stage AS idea_stage
    FROM idea_people x JOIN people p ON p.id = x.person_id JOIN ideas i ON i.id = x.idea_id LEFT JOIN companies c ON c.id = p.company_id
    WHERE (? IS NULL OR x.idea_id = ?) AND (? IS NULL OR x.person_id = ?)
    ORDER BY CASE x.interest WHEN 'ilgilendi' THEN 0 WHEN 'anlatildi' THEN 1 ELSE 2 END, x.updated_at DESC`,
    ideaId ?? null, ideaId ?? null, personId ?? null, personId ?? null);
}
