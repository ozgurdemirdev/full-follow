/** Hook'lar on=false ile çağrılırsa istek yapılmaz (ör. arama ilk odaklanana kadar). */
// Ekranlar arası paylaşılan sorgu anahtarları: aynı anahtar = tek istek, tek önbellek kaydı.
// Every key here is a list the screens read whole: `useIndex` reads it page by page (DRAIN_PAGE rows a request) until `total` is reached.
// People and companies are not here: there can be thousands of them, so the screens page through them (`usePaged`) and the pickers ask the server (`useSearchRows`).
import { useMemo } from "react";
import { drained } from "./paged";
import type { Idea, List, OwnProject, Opportunity, PipelineMeta, Post, Project, Sector, Source, Tag, Task, Thread, TrashItem } from "./types";
import { useQuery } from "./store";

export const K = {
  today: "/today?limit=20",
  // kategoriler silinenlerle birlikte gelir: kayıtlarda görünmeye devam ederler, seçicilerde gizlenir
  sources: "/sources?all=true",
  tags: "/tags?all=true",
  trash: "/trash",
  board: "/opportunities?board=true",
  opps: "/opportunities",
  /** Lost opportunities only (the lost reasons of the pipeline screen) */
  lost: "/opportunities?stage=kaybedildi",
  projects: "/projects",
  openTasks: "/tasks",
  threads: "/comments",
  settings: "/settings",
  sectors: "/sectors?all=true",
  posts: "/posts",
  ideas: "/ideas",
  ownProjects: "/own-projects",
};

/** A list read whole: its rows, an index by id and the server's `total` (the count a screen shows) */
export function useIndex<T extends { id: number }, Extra extends object = object>(key: string | null) {
  const q = useQuery<List<T> & Extra>(key, drained);
  const byId = useMemo(() => new Map((q.data?.rows ?? []).map((r) => [r.id, r])), [q.data]);
  return { ...q, rows: q.data?.rows ?? [], total: q.data?.total ?? 0, byId };
}

export const useSources = (on = true) => useIndex<Source>(on ? K.sources : null);
/** The board list carries `meta`: the stage rules and the stage to stage rates (see PipelineMeta) */
export const useBoard = (on = true) => useIndex<Opportunity, { meta?: PipelineMeta }>(on ? K.board : null);
export const useOpps = (on = true) => useIndex<Opportunity>(on ? K.opps : null);
export const useLostOpps = (on = true) => useIndex<Opportunity>(on ? K.lost : null);
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
export const useIdeas = (on = true) => useIndex<Idea>(on ? K.ideas : null);
export const useOwnProjects = (on = true) => useIndex<OwnProject>(on ? K.ownProjects : null);
