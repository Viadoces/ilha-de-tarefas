import { useCallback, useEffect, useRef, useState } from "react";
import seed from "../seed.json";
import { type Chat, MAX_MESSAGES } from "./claude";
import { native } from "./native";
import type { Data, Entry, Settings, Task } from "./tasks";

export type Store = ReturnType<typeof useData>;

export function useData() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Data | null>(null);

  useEffect(() => {
    native
      .load()
      .then((raw) => setData(raw ? (JSON.parse(raw) as Data) : (structuredClone(seed) as Data)))
      // Se o arquivo existir mas estiver ilegível, não carregamos nada para não sobrescrevê-lo.
      .catch((e) => setError(`Não consegui ler os dados: ${e}`));
  }, []);

  useEffect(() => {
    latest.current = data;
    if (!data) return;
    const t = setTimeout(() => {
      native.save(JSON.stringify(data, null, 1)).catch((e) => setError(`Erro ao salvar: ${e}`));
    }, 250);
    return () => clearTimeout(t);
  }, [data]);

  const update = useCallback((fn: (d: Data) => Data) => setData((d) => (d ? fn(d) : d)), []);

  const patchEntry = useCallback(
    (taskId: string, period: string, patch: (e: Entry) => Entry) =>
      update((d) => {
        const current = d.log[taskId]?.[period] ?? { done: false };
        return {
          ...d,
          log: { ...d.log, [taskId]: { ...d.log[taskId], [period]: patch(current) } },
        };
      }),
    [update],
  );

  const toggle = useCallback(
    (taskId: string, period: string) =>
      patchEntry(taskId, period, (e) =>
        e.done ? { ...e, done: false, doneAt: undefined } : { ...e, done: true, doneAt: new Date().toISOString() },
      ),
    [patchEntry],
  );

  const setNote = useCallback(
    (taskId: string, period: string, note: string) =>
      patchEntry(taskId, period, (e) => ({ ...e, note: note || undefined })),
    [patchEntry],
  );

  const upsertTask = useCallback(
    (task: Task) =>
      update((d) => {
        const exists = d.tasks.some((t) => t.id === task.id);
        return { ...d, tasks: exists ? d.tasks.map((t) => (t.id === task.id ? task : t)) : [...d.tasks, task] };
      }),
    [update],
  );

  const setArchived = useCallback(
    (id: string, archived: boolean) =>
      update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, archived } : t)) })),
    [update],
  );

  const removeTask = useCallback(
    (id: string) =>
      update((d) => {
        const { [id]: _removed, ...log } = d.log;
        return { ...d, tasks: d.tasks.filter((t) => t.id !== id), log };
      }),
    [update],
  );

  const setSettings = useCallback(
    (patch: Partial<Settings>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    [update],
  );

  const updateChat = useCallback(
    (fn: (c: Chat) => Chat) =>
      update((d) => {
        const chat = fn(d.chat ?? { messages: [] });
        return { ...d, chat: { ...chat, messages: chat.messages.slice(-MAX_MESSAGES) } };
      }),
    [update],
  );

  /** Grava imediatamente (usado antes de fechar o app). */
  const flush = useCallback(async () => {
    if (latest.current) await native.save(JSON.stringify(latest.current, null, 1));
  }, []);

  return { data, error, toggle, setNote, upsertTask, setArchived, removeTask, setSettings, updateChat, flush };
}

export const newTaskId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
