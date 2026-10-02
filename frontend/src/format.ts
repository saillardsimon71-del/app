import { differenceInCalendarDays, format, getISOWeek, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

import type { ProjectType, Status } from "./api";

export const d = (iso: string) => parseISO(iso.slice(0, 10));
export const fmtShort = (iso: string) => format(d(iso), "d MMM", { locale: fr });
export const fmtDate = (iso: string) => format(d(iso), "d MMM yyyy", { locale: fr });
export const fmtNum = (iso: string) => format(d(iso), "dd/MM/yyyy");
export const fmtNumShort = (iso: string) => format(d(iso), "dd/MM/yy");
export const fmtLong = (iso: string) => format(d(iso), "EEEE d MMMM yyyy", { locale: fr });
export const week = (iso: string) => `S${getISOWeek(d(iso))}`;
export const toISO = (date: Date) => format(date, "yyyy-MM-dd");
export const daysFromToday = (iso: string) => differenceInCalendarDays(d(iso), new Date());

export const STATUS_LABEL: Record<Status, string> = {
  en_retard: "En retard",
  a_risque: "À risque",
  dans_les_temps: "Dans les temps",
  a_venir: "À venir",
  termine: "Terminé",
};

export const TYPE_INFO: Record<ProjectType, { label: string; short: string; desc: string }> = {
  NPD: { label: "New Product Development", short: "Nouveau produit", desc: "Verre + décor complets, produit inédit sur le marché." },
  DUP: { label: "Duplication", short: "Duplication", desc: "Verre + décor complets, produit existant ailleurs mais pas chez nous." },
  FLK: { label: "Flanker", short: "Décor seul", desc: "Verre déjà en gamme, seul le décor est développé." },
  MLD: { label: "Mold Change", short: "Moule ajusté", desc: "Ajustement mineur d'un moule existant (bague, largeur…)." },
};

export const TYPE_DEFAULTS: Record<ProjectType, { glass: number; decor: number }> = {
  NPD: { glass: 4, decor: 3 },
  DUP: { glass: 4, decor: 3 },
  FLK: { glass: 0, decor: 3 },
  MLD: { glass: 1, decor: 3 },
};

export const PACKAGING_LABEL = { croisillons: "Croisillons", barquettes: "Barquettes", ptf: "PTF" } as const;
