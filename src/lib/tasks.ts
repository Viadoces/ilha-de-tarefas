// Modelo de dados e regras de recorrência.
// "owners" é uma lista desde já para facilitar a versão multiusuário.

import type { Chat } from "./claude";

export type Recurrence =
  | { kind: "monthly"; day: number } // todo dia N do mês
  | { kind: "weekly"; weekday: number } // 0 = domingo … 6 = sábado
  | { kind: "yearly"; month: number | null } // 1–12, ou sem mês definido
  | { kind: "event"; label: string }; // sem dia fixo ("quando fechar o fiscal"); reinicia todo mês

export interface Task {
  id: string;
  title: string;
  owners: string[];
  recurrence: Recurrence;
  archived: boolean;
}

/** Situação de uma tarefa num período (mês, semana ou ano). */
export interface Entry {
  done: boolean;
  note?: string;
  doneAt?: string;
}

export interface Data {
  version: 1;
  tasks: Task[];
  /** log[taskId][periodo] — ex.: log.t001["2026-11"] */
  log: Record<string, Record<string, Entry>>;
  settings?: Settings;
  /** Conversa da aba Claude. */
  chat?: Chat;
}

export interface Settings {
  /** Pasta do vault do Obsidian; vazio = detectar automaticamente. */
  vaultPath?: string;
  /** Já passou pelo assistente de primeira execução. */
  onboarded?: boolean;
  /** Modelo e nível de esforço da aba Claude; vazio = padrão do Claude Code. */
  claudeModel?: string;
  claudeEffort?: string;
  /** Modo de permissão do Claude Code; vazio = acesso total. */
  claudePermission?: string;
}

export type Status = "overdue" | "today" | "soon" | "later" | "waiting" | "yearly" | "done";

export interface Item {
  task: Task;
  period: string;
  entry?: Entry;
  status: Status;
  due: Date | null;
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

function isoWeekKey(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${t.getUTCFullYear()}-S${pad(week)}`;
}

export function periodKey(r: Recurrence, ref: Date) {
  if (r.kind === "weekly") return isoWeekKey(ref);
  if (r.kind === "yearly") return String(ref.getFullYear());
  return monthKey(ref);
}

export function dueDate(r: Recurrence, ref: Date): Date | null {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  switch (r.kind) {
    case "monthly": {
      const lastDay = new Date(y, m + 1, 0).getDate();
      return new Date(y, m, Math.min(r.day, lastDay));
    }
    case "weekly": {
      const s = startOfDay(ref);
      const fromMonday = (s.getDay() + 6) % 7;
      const target = (r.weekday + 6) % 7;
      return new Date(s.getFullYear(), s.getMonth(), s.getDate() - fromMonday + target);
    }
    case "yearly":
      return r.month ? new Date(y, r.month, 0) : null;
    case "event":
      return null;
  }
}

export const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);

function statusOf(task: Task, entry: Entry | undefined, due: Date | null, today: Date): Status {
  if (entry?.done) return "done";
  if (!due) return task.recurrence.kind === "yearly" ? "yearly" : "waiting";
  const diff = daysBetween(today, due);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "soon";
  return "later";
}

/** Data de referência ao olhar um mês: hoje no mês atual, último dia nos passados, primeiro nos futuros. */
export function referenceDate(viewMonth: Date, today: Date) {
  const v = monthKey(viewMonth);
  const t = monthKey(today);
  if (v === t) return today;
  return v < t ? new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0) : viewMonth;
}

export function buildItems(data: Data, ref: Date, today: Date): Item[] {
  return data.tasks
    .filter((t) => !t.archived)
    .map((task) => {
      const period = periodKey(task.recurrence, ref);
      const entry = data.log[task.id]?.[period];
      const due = dueDate(task.recurrence, ref);
      return { task, period, entry, due, status: statusOf(task, entry, due, today) };
    })
    .sort((a, b) => {
      const da = a.due?.getTime() ?? Infinity;
      const db = b.due?.getTime() ?? Infinity;
      return da - db || a.task.title.localeCompare(b.task.title, "pt-BR");
    });
}

export function recurrenceLabel(r: Recurrence) {
  switch (r.kind) {
    case "monthly":
      return `todo dia ${r.day}`;
    case "weekly":
      return `${r.weekday === 0 || r.weekday === 6 ? "todo" : "toda"} ${DIAS[r.weekday]}`;
    case "yearly":
      return r.month ? `anual · ${MESES[r.month - 1].toLowerCase()}` : "anual";
    case "event":
      return r.label;
  }
}

export function relativeLabel(due: Date, today: Date) {
  const d = daysBetween(today, due);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  return d < 0 ? `há ${-d} dias` : `em ${d} dias`;
}

/** Busca sem acentos e sem diferenciar maiúsculas. */
export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const OWNER_COLORS = ["#ff9f0a", "#64d2ff", "#bf5af2", "#30d158", "#ff6482", "#ffd60a", "#7d7aff", "#66d4cf"];
const assigned = new Map<string, string>();

/** Distribui as cores em ordem alfabética, para que duas pessoas nunca fiquem com a mesma cor (até 8). */
export function registerOwners(tasks: Task[]) {
  const names = [...new Set(tasks.flatMap((t) => t.owners))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  assigned.clear();
  names.forEach((n, i) => assigned.set(n, OWNER_COLORS[i % OWNER_COLORS.length]));
}

export function ownerColor(name: string) {
  const known = assigned.get(name);
  if (known) return known;
  let h = 0;
  for (const ch of normalize(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return OWNER_COLORS[h % OWNER_COLORS.length];
}
