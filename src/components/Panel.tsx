import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ClaudeSession } from "../lib/useClaude";
import type { Store } from "../lib/useData";
import { ClaudeView } from "./ClaudeView";
import { ChevronUp } from "./icons";
import { Onboarding } from "./Onboarding";
import { VaultView } from "./VaultView";
import { TasksView } from "./TasksView";

type Tab = "tarefas" | "consultas" | "claude";
const TABS: [Tab, string][] = [
  ["tarefas", "Tarefas"],
  ["consultas", "Obsidian"],
  ["claude", "Claude"],
];
const TAB_KEY = "ilha-aba";

interface Props {
  store: Store;
  claude: ClaudeSession;
  now: Date;
  onClose: () => void;
  onCopied: (what: string) => void;
}

export function Panel({ store, claude, now, onClose, onCopied }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      return TABS.some(([id]) => id === saved) ? (saved as Tab) : "tarefas";
    } catch { return "tarefas"; }
  });

  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab); } catch { /* só não lembra a aba */ }
  }, [tab]);

  // As abas tratam o Esc no `document` primeiro; se ninguém usou, recolhe a ilha.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!store.data?.settings?.onboarded) {
    return (
      <div className="panel">
        <div className="tabs-row onboard-top">
          <span />
          <button className="icon" onClick={onClose} aria-label="Recolher"><ChevronUp /></button>
        </div>
        <Onboarding store={store} />
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="tabs-row">
        <div className="tabs">
          {TABS.map(([id, name]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {tab === id && <motion.span layoutId="tab-bg" className="tab-bg" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span>{name}</span>
            </button>
          ))}
        </div>
        <button className="icon" onClick={onClose} aria-label="Recolher"><ChevronUp /></button>
      </div>

      {tab === "tarefas" ? (
        <TasksView store={store} now={now} />
      ) : tab === "consultas" ? (
        <VaultView store={store} now={now} onCopied={onCopied} />
      ) : (
        <ClaudeView store={store} claude={claude} now={now} onCopied={onCopied} />
      )}
    </div>
  );
}
