// Estado da aba Claude. Fica no App (sempre montado) para a resposta continuar chegando
// mesmo com a ilha recolhida ou em outra aba.
import { useCallback, useEffect, useRef, useState } from "react";
import { type Chat, type ChatMsg, exitError, isMissingSession, parseLine } from "./claude";
import { native } from "./native";
import type { Store } from "./useData";

export type ClaudeSession = ReturnType<typeof useClaude>;

const EMPTY: Chat = { messages: [] };

export function useClaude(store: Store) {
  const chat = store.data?.chat ?? EMPTY;
  const configured = store.data?.settings?.vaultPath?.trim() || "";
  const settings = store.data?.settings;
  const opts = useRef({ model: "", effort: "", permission: "" });
  opts.current = {
    model: settings?.claudeModel ?? "",
    effort: settings?.claudeEffort ?? "",
    permission: settings?.claudePermission ?? "",
  };
  const [vault, setVault] = useState<string | null | undefined>(undefined); // undefined = procurando
  const [installed, setInstalled] = useState<boolean | undefined>(undefined);
  const [running, setRunning] = useState(false);

  const run = useRef(0);
  const session = useRef(chat.sessionId);
  session.current = chat.sessionId;
  // Última pergunta e se o --resume falhou: para reenviar sem a sessão perdida.
  const pending = useRef<{ prompt: string; cwd: string; missing: boolean } | null>(null);

  const { updateChat } = store;
  const push = useCallback((...msgs: ChatMsg[]) => updateChat((c) => ({ ...c, messages: [...c.messages, ...msgs] })), [updateChat]);

  useEffect(() => {
    let alive = true;
    (configured ? Promise.resolve(configured) : native.findVault())
      .then((v) => alive && setVault(v))
      .catch(() => alive && setVault(null));
    return () => { alive = false; };
  }, [configured]);

  const checkInstalled = useCallback(async () => {
    setInstalled(undefined);
    setInstalled(!!(await native.claude.find().catch(() => null)));
  }, []);
  useEffect(() => { checkInstalled(); }, [checkInstalled]);

  const start = useCallback(
    (prompt: string, cwd: string, sessionId: string | null) => {
      const id = ++run.current;
      pending.current = { prompt, cwd, missing: false };
      setRunning(true);
      native.claude.send(id, prompt, cwd, sessionId, opts.current).catch((e) => {
        if (id !== run.current) return;
        setRunning(false);
        push({ role: "error", text: String(e) });
      });
    },
    [push],
  );

  useEffect(() => {
    const offLine = native.claude.onLine(({ run: r, line }) => {
      if (r !== run.current) return;
      const p = parseLine(line);
      if (p.missingSession && pending.current) pending.current.missing = true;
      if (!p.session && !p.msgs.length) return;
      updateChat((c) => ({ sessionId: p.session ?? c.sessionId, messages: [...c.messages, ...p.msgs] }));
    });
    const offDone = native.claude.onDone(({ run: r, code, stderr }) => {
      if (r !== run.current) return;
      const last = pending.current;
      // A conversa salva não existe mais no Claude Code: recomeça sem --resume.
      if (last && (last.missing || (code !== 0 && isMissingSession(stderr)))) {
        updateChat((c) => ({ ...c, sessionId: undefined }));
        start(last.prompt, last.cwd, null);
        return;
      }
      setRunning(false);
      pending.current = null;
      if (code !== 0 && code !== null) {
        // Sem `result` de erro na saída? Então mostra o stderr.
        updateChat((c) => {
          const tail = c.messages[c.messages.length - 1];
          if (tail?.role === "error" || tail?.role === "info") return c;
          return { ...c, messages: [...c.messages, { role: "error", text: exitError(code, stderr) }] };
        });
      }
    });
    return () => { offLine(); offDone(); };
  }, [updateChat, start]);

  const send = useCallback(
    (text: string) => {
      const prompt = text.trim();
      if (!prompt || running || !vault) return;
      push({ role: "user", text: prompt });
      start(prompt, vault, session.current ?? null);
    },
    [running, vault, push, start],
  );

  const stop = useCallback(async () => {
    if (!running) return;
    pending.current = null;
    push({ role: "info", text: "Interrompido." });
    await native.claude.stop().catch(console.error);
  }, [running, push]);

  /** Apaga a conversa do app e o histórico salvo pelo Claude Code. */
  const clear = useCallback(async () => {
    const old = session.current;
    if (running) {
      pending.current = null;
      await native.claude.stop().catch(console.error);
    }
    run.current++; // ignora o que ainda chegar da execução anterior
    setRunning(false);
    updateChat(() => ({ messages: [] }));
    if (old) await native.claude.forget(old).catch(console.error);
  }, [running, updateChat]);

  return { chat, vault, installed, running, send, stop, clear, checkInstalled };
}
