import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMsg } from "../lib/claude";
import { native } from "../lib/native";
import type { ClaudeSession } from "../lib/useClaude";
import type { Store } from "../lib/useData";
import { ArrowUp, External, Stop, Trash } from "./icons";
import { Markdown, type MdContext } from "./Markdown";
import { ModelPicker } from "./ModelPicker";

const SUGGESTIONS = [
  "Quais projetos estão ativos agora?",
  "Resuma o que mudou nas notas esta semana",
  "Crie uma nota com as ideias de hoje",
];

interface Props {
  store: Store;
  claude: ClaudeSession;
  now: Date;
  onCopied: (what: string) => void;
}

export function ClaudeView({ store, claude, now, onCopied }: Props) {
  const { chat, vault, installed, running } = claude;
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const vaultName = vault ? vault.split(/[\\/]/).filter(Boolean).pop() : null;
  const ready = installed === true && !!vault;

  // Links [[nota]] das respostas abrem direto no Obsidian.
  const ctx: MdContext = {
    hasNote: () => !!vault,
    openNote: (t) => vault && native.openInObsidian(vault, t.split("#")[0]),
    openUrl: (url) => native.openLink(url),
    now,
    onCopied,
  };

  useLayoutEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length, running]);

  useEffect(() => { if (ready) input.current?.focus(); }, [ready]);

  // Esc cancela a confirmação antes de recolher a ilha.
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); setConfirming(false); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  const autosize = () => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  };
  useLayoutEffect(autosize, [draft]);

  const submit = () => {
    if (!draft.trim() || running) return;
    claude.send(draft);
    setDraft("");
  };

  return (
    <>
      <div className="chat-head">
        <div className="chat-title">
          <b>Claude</b>
          {vaultName && <span>{vaultName}</span>}
        </div>
        {!confirming && <ModelPicker store={store} />}
        <AnimatePresence mode="wait" initial={false}>
          {confirming ? (
            <motion.div key="confirm" className="confirm" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              <span>Apagar conversa?</span>
              <button className="ghost" onClick={() => setConfirming(false)}>Cancelar</button>
              <button className="danger" onClick={async () => { setConfirming(false); await claude.clear(); input.current?.focus(); }}>Apagar</button>
            </motion.div>
          ) : (
            <motion.button
              key="trash"
              className="icon"
              title="Apagar conversa"
              aria-label="Apagar conversa"
              disabled={!chat.messages.length}
              onClick={() => setConfirming(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: chat.messages.length ? 1 : 0.3 }}
              exit={{ opacity: 0 }}
            >
              <Trash />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="chat-list" ref={list}>
        {installed === false ? (
          <div className="chat-empty">
            <p>O Claude Code não está instalado neste computador.</p>
            <p className="faint">Instale, abra um terminal e rode <code>claude</code> uma vez para fazer login.</p>
            <div className="chat-empty-actions">
              <button className="ghost" onClick={() => native.openLink("https://claude.com/claude-code")}>Como instalar <External /></button>
              <button className="ghost" onClick={claude.checkInstalled}>Verificar de novo</button>
            </div>
          </div>
        ) : vault === null ? (
          <div className="chat-empty">
            <p>Não encontrei o vault do Obsidian.</p>
            <p className="faint">Informe a pasta na engrenagem da aba Obsidian.</p>
          </div>
        ) : !chat.messages.length ? (
          <div className="chat-empty">
            <p>Pergunte sobre suas notas, peça resumos ou mande criar e editar notas.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" disabled={!ready} onClick={() => { setDraft(s); input.current?.focus(); }}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          chat.messages.map((m, i) => <Message key={i} m={m} ctx={ctx} />)
        )}
        {running && (
          <div className="thinking" aria-label="Claude está respondendo">
            <i /><i /><i />
          </div>
        )}
      </div>

      <div className="composer">
        <textarea
          ref={input}
          rows={1}
          value={draft}
          disabled={!ready}
          placeholder={ready ? "Pergunte ao Claude…" : ""}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {running ? (
          <button className="send stop" onClick={claude.stop} title="Parar" aria-label="Parar"><Stop /></button>
        ) : (
          <button className="send" onClick={submit} disabled={!draft.trim() || !ready} title="Enviar" aria-label="Enviar"><ArrowUp /></button>
        )}
      </div>
    </>
  );
}

function Message({ m, ctx }: { m: ChatMsg; ctx: MdContext }) {
  switch (m.role) {
    case "user":
      return <div className="msg user">{m.text}</div>;
    case "assistant":
      return <div className="msg assistant"><Markdown source={m.text} ctx={ctx} /></div>;
    case "tool":
      return <div className="msg tool">{m.text}</div>;
    case "info":
      return <div className="msg info">{m.text}</div>;
    case "error":
      return <div className="msg error"><Markdown source={m.text} ctx={ctx} /></div>;
  }
}
