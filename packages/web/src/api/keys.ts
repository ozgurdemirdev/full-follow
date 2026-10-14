/** Hook'lar on=false ile çağrılırsa istek yapılmaz (ör. arama ilk odaklanana kadar). */
// Ekranlar arası paylaşılan sorgu anahtarları: aynı anahtar = tek istek, tek önbellek kaydı
import { useMemo } from "react";
import type { Company, Idea, List, OwnProject, Opportunity, Person, PipelineMeta, Post, Project, Sector, Source, Tag, Task, Template, Thread, TrashItem } from "./types";
import { useQuery } from "./store";

const ALL = 1000;

export const K = {
  today: "/today?limit=20",
  people: `/people?limit=${ALL}`,
  companies: `/companies?limit=${ALL}`,
  // kategoriler silinenlerle birlikte gelir: kayıtlarda görünmeye devam ederler, seçicilerde gizlenir
  sources: `/sources?all=true&limit=${ALL}`,
  tags: `/tags?all=true&limit=${ALL}`,
  trash: `/trash?limit=${ALL}`,
  board: `/opportunities?board=true&limit=${ALL}`,
  opps: `/opportunities?limit=${ALL}`,
  projects: `/projects?limit=${ALL}`,
  openTasks: `/tasks?limit=${ALL}`,
  threads: `/comments?limit=${ALL}`,
  allThreads: `/comments?resolved=all&messages=true&limit=${ALL}`,
  drafts: `/drafts?limit=${ALL}`,
  settings: "/settings",
  sectors: `/sectors?all=true&limit=${ALL}`,
  referrals: "/report/referrals",
  marketing: "/report/marketing",
  posts: `/posts?limit=${ALL}`,
  templates: `/templates?limit=${ALL}`,
  ideas: `/ideas?limit=${ALL}`,
  ownProjects: `/own-projects?limit=${ALL}`,
};

function useIndex<T extends { id: number }, Extra extends object = object>(key: string | null) {
  const q = useQuery<List<T> & Extra>(key);
  const byId = useMemo(() => new Map((q.data?.rows ?? []).map((r) => [r.id, r])), [q.data]);
  return { ...q, rows: q.data?.rows ?? [], byId };
}

export const usePeople = (on = true) => useIndex<Person>(on ? K.people : null);
export const useCompanies = (on = true) => useIndex<Company>(on ? K.companies : null);
export const useSources = (on = true) => useIndex<Source>(on ? K.sources : null);
/** The board list carries `meta`: the stage rules and the stage to stage rates (see PipelineMeta) */
export const useBoard = (on = true) => useIndex<Opportunity, { meta?: PipelineMeta }>(on ? K.board : null);
export const useOpps = (on = true) => useIndex<Opportunity>(on ? K.opps : null);
export const useProjects = (on = true) => useIndex<Project>(on ? K.projects : null);
export const useOpenTasks = (on = true) => useIndex<Task>(on ? K.openTasks : null);
export const useSectors = (on = true) => useIndex<Sector>(on ? K.sectors : null);
export const cardKey = (id: number) => `/people/${id}/card`;
export const companyCardKey = (id: number) => `/companies/${id}/card`;
export const useTags = (on = true) => useIndex<Tag>(on ? K.tags : null);
export const useTrash = (on = true) => useIndex<TrashItem & { id: number }>(on ? K.trash : null);
/** Seçicilerde sadece silinmemiş kategoriler; kayıtta zaten olan silinmiş kategori yine görünür */
export const pickable = <T extends { id: number; deleted_at: string | null }>(rows: T[], keep: readonly number[] = []) =>
  rows.filter((r) => !r.deleted_at || keep.includes(r.id));
export const useThreads = (on = true) => useIndex<Thread>(on ? K.threads : null);
export const usePosts = (on = true) => useIndex<Post>(on ? K.posts : null);
export const useTemplates = (on = true) => useIndex<Template>(on ? K.templates : null);
export const useIdeas = (on = true) => useIndex<Idea>(on ? K.ideas : null);
export const useOwnProjects = (on = true) => useIndex<OwnProject>(on ? K.ownProjects : null);
