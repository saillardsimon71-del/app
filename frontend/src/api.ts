import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type ProjectType = "NPD" | "DUP" | "FLK" | "MLD";
export type Status = "en_retard" | "a_risque" | "dans_les_temps" | "a_venir" | "termine";

export type Step = {
  key: string;
  phase: string;
  name: string;
  start: string;
  end: string;
  duration: number;
  milestone: boolean;
  client_validation: boolean;
  done: boolean;
  done_at?: string | null;
};

export type Phase = { key: string; name: string; start: string; end: string; done: number; total: number; late: number };

export type ProjectInput = {
  name: string;
  code?: string | null;
  client_id: string;
  type: ProjectType;
  mad_date: string;
  moq?: number | null;
  tech_specs?: string | null;
  preseries_needed: boolean;
  preseries_mode: "sequentielle" | "parallele";
  packaging_type: "croisillons" | "barquettes" | "ptf";
  ptf_lead_days: number;
  glass_cycles: number;
  decor_cycles: number;
  notes?: string | null;
  archived?: boolean;
};

export type Photo = { id: string; path: string; name: string; content_type: string; size: number; created_at: string };

export type Project = ProjectInput & {
  id: string;
  client_name: string;
  steps: Step[];
  photos: Photo[];
  start_date: string;
  total_days: number;
  total_weeks: number;
  progress: number;
  done_count: number;
  step_count: number;
  late_count: number;
  status: Status;
  next_step: Step | null;
  phases: Phase[];
  archived: boolean;
};

export type Lever = {
  key: string;
  label: string;
  condition: string;
  gain_days: number;
  gain_weeks: number;
  patch: Partial<ProjectInput>;
};

export type Preview = {
  steps: Step[];
  start_date: string;
  total_days: number;
  total_weeks: number;
  levers: Lever[];
  phases: Phase[];
  start_in_past_days: number;
  validation_delay_days: number;
};

export type Client = {
  id: string;
  name: string;
  contact?: string | null;
  email?: string | null;
  validation_delay_days: number;
  notes?: string | null;
  project_count?: number;
};

export type ClientInput = Omit<Client, "id" | "project_count">;

export type Settings = { order_offset_days: number; default_validation_delay: number };

export type DashItem = Step & {
  project_id: string;
  project_name: string;
  client_name: string;
  project_type: ProjectType;
  days_late?: number;
  days_left?: number;
};

export type Dashboard = {
  active_count: number;
  counts: Record<Status, number>;
  late_steps: DashItem[];
  upcoming: DashItem[];
  pending_validations: number;
  next_mad: { id: string; name: string; client_name: string; mad_date: string; type: ProjectType; status: Status; progress: number }[];
};

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const j = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail)) msg = "Certains champs sont invalides";
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export type LocalPhoto = { uri: string; name: string; type: string };

export const photoUrl = (p: Photo) => `${BASE}/files/${p.path}`;

export async function uploadPhoto(projectId: string, photo: LocalPhoto): Promise<Project> {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(photo.uri)).blob();
    form.append("file", blob, photo.name);
  } else {
    form.append("file", { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
  }
  const res = await fetch(`${BASE}/projects/${projectId}/photos`, { method: "POST", body: form });
  if (!res.ok) {
    let msg = "Impossible d'ajouter la photo";
    try {
      const j = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const deletePhoto = (projectId: string, photoId: string) =>
  api<Project>(`/projects/${projectId}/photos/${photoId}`, { method: "DELETE" });

export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
export const useProjects = () => useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
export const useProject = (id?: string) =>
  useQuery({ queryKey: ["project", id], queryFn: () => api<Project>(`/projects/${id}`), enabled: !!id });
export const useClients = () => useQuery({ queryKey: ["clients"], queryFn: () => api<Client[]>("/clients") });
export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings") });

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useToggleStep(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, done }: { key: string; done: boolean }) =>
      api<Project>(`/projects/${projectId}/steps/${key}`, { method: "PATCH", body: { done } }),
    onMutate: async ({ key, done }) => {
      await qc.cancelQueries({ queryKey: ["project", projectId] });
      const prev = qc.getQueryData<Project>(["project", projectId]);
      if (prev) {
        qc.setQueryData<Project>(["project", projectId], {
          ...prev,
          steps: prev.steps.map((s) => (s.key === key ? { ...s, done } : s)),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["project", projectId], ctx.prev),
    onSuccess: (p) => {
      qc.setQueryData(["project", projectId], p);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
