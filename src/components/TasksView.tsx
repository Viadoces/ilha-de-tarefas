import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { native } from "../lib/native";
import {
  type Item, MESES, type Status, type Task,
  buildItems, monthKey, normalize, referenceDate,
} from "../lib/tasks";
import type { Store } from "../lib/useData";
import { ChevronLeft, ChevronRight, Plus, Search } from "./icons";
import { SettingsMenu } from "./SettingsMenu";
import { Owners, TaskRow } from "./TaskRow";
import { TaskForm } from "./TaskForm";

const SECTIONS: [Status, string][] = [
  ["overdue", "Atrasadas"],
  ["today", "Hoje"],
  ["soon", "Próximos 7 dias"],
  ["later", "Mais adiante"],
  ["waiting", "Sem dia fixo"],
  ["yearly", "Anuais"],
  ["done", "Concluídas"],
];

const OWNER_KEY = "ilha-filtro-responsavel";
const readOwner = () => {
  try { return localStorage.getItem(OWNER_KEY); } catch { return null; }
};

export function TasksView({ store, now }: { store: Store; now: Date }) {
  const data = store.data!;
  const [view, setView] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [owner, setOwner] = useState<string | null>(readOwner);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      owner ? localStorage.setItem(OWNER_KEY, owner) : localStorage.removeItem(OWNER_KEY);
    } catch { /* sem armazenamento: o filtro só não é lembrado */ }
  }, [owner]);

  // Esc fecha o que estiver aberto aqui dentro; se não houver nada, o painel recolhe a ilha.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (editing) setEditing(null);
      else if (searching) { setSearching(false); setQuery(""); }
      else if (expandedId) setExpandedId(null);
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, searching, expandedId]);

  const isCurrentMonth = monthKey(view) === monthKey(now);
  const ref = referenceDate(view, now);
  const items = useMemo(() => buildItems(data, ref, now), [data, ref.getTime(), now.getTime()]);

  const owners = useMemo(() => {
    const count = new Map<string, number>();
    data.tasks.filter((t) => !t.archived).forEach((t) => t.owners.forEach((o) => count.set(o, (count.get(o) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o);
  }, [data.tasks]);

  const q = normalize(query.trim());
  const visible = items.filter(
    (i) =>
      (!owner || i.task.owners.includes(owner)) &&
      (!q || normalize(`${i.task.title} ${i.entry?.note ?? ""}`).includes(q)),
  );
  const doneCount = visible.filter((i) => i.status === "done").length;
  const progress = visible.length ? doneCount / visible.length : 0;
  const archived = data.tasks.filter((t) => t.archived);

  const shiftMonth = (delta: number) => {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
    setExpandedId(null);
  };

  const periodName = MESES[view.getMonth()].toLowerCase();

  const renderRow = (i: Item) => (
    <TaskRow
      key={i.task.id}
      item={i}
      today={now}
      periodName={periodName}
      expanded={expandedId === i.task.id}
      onToggle={() => store.toggle(i.task.id, i.period)}
      onExpand={() => setExpandedId(expandedId === i.task.id ? null : i.task.id)}
      onNote={(n) => store.setNote(i.task.id, i.period, n)}
      onEdit={() => setEditing(i.task)}
      onArchive={() => { store.setArchived(i.task.id, true); setExpandedId(null); }}
    />
  );

  return (
    <>
      <header className="panel-head">
        <div className="month">
          <button className="icon" onClick={() => shiftMonth(-1)} aria-label="Mês anterior"><ChevronLeft /></button>
          <button className="month-name" onClick={() => setView(new Date(now.getFullYear(), now.getMonth(), 1))} title="Voltar para o mês atual">
            {MESES[view.getMonth()]}
            <span>{view.getFullYear()}</span>
            {!isCurrentMonth && <em>voltar a hoje</em>}
          </button>
          <button className="icon" onClick={() => shiftMonth(1)} aria-label="Próximo mês"><ChevronRight /></button>
        </div>

        <div className="progress" title={`${doneCount} de ${visible.length} concluídas`}>
          <svg viewBox="0 0 36 36" width="30" height="30">
            <circle cx="18" cy="18" r="15" className="progress-track" />
            <motion.circle
              cx="18" cy="18" r="15" className="progress-bar"
              pathLength={1}
              strokeDasharray="1 1"
              initial={false}
              animate={{ strokeDashoffset: 1 - progress }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </svg>
          <span><b>{doneCount}</b>/{visible.length}</span>
        </div>
      </header>

      <div className="filters">
        <button
          className={`icon search-btn${searching ? " on" : ""}`}
          onClick={() => {
            setSearching(!searching);
            if (searching) setQuery("");
            else setTimeout(() => searchRef.current?.focus(), 30);
          }}
          aria-label="Buscar"
        >
          <Search />
        </button>
        <AnimatePresence mode="popLayout" initial={false}>
          {searching ? (
            <motion.input
              key="search"
              ref={searchRef}
              className="search"
              placeholder="Buscar tarefa ou nota…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "100%" }}
              exit={{ opacity: 0, width: 0 }}
            />
          ) : (
            <motion.div key="chips" className="chips scroll" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button className={`chip${owner === null ? " on" : ""}`} onClick={() => setOwner(null)}>Todos</button>
              {owners.map((o) => (
                <button key={o} className={`chip${owner === o ? " on" : ""}`} onClick={() => setOwner(owner === o ? null : o)}>
                  <Owners owners={[o]} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="list">
        {SECTIONS.map(([status, title]) => {
          const group = visible.filter((i) => i.status === status);
          if (!group.length) return null;
          const collapsible = status === "done";
          const open = !collapsible || showDone || !!q;
          return (
            <section key={status} className={`section sec-${status}`}>
              <button
                className="section-title"
                onClick={collapsible ? () => setShowDone(!showDone) : undefined}
                disabled={!collapsible}
              >
                {title}
                <span className="count">{group.length}</span>
                {collapsible && <span className={`caret${open ? " open" : ""}`}><ChevronRight /></span>}
              </button>
              <AnimatePresence initial={false}>{open && group.map(renderRow)}</AnimatePresence>
            </section>
          );
        })}

        {visible.length === 0 && (
          <div className="empty">{q ? "Nada encontrado." : "Nenhuma tarefa por aqui."}</div>
        )}
        {visible.length > 0 && doneCount === visible.length && (
          <div className="empty done">Tudo feito em {periodName}. ✓</div>
        )}

        {showArchived && archived.length > 0 && (
          <section className="section sec-archived">
            <div className="section-title">Arquivadas <span className="count">{archived.length}</span></div>
            {archived.map((t) => (
              <div key={t.id} className="row s-archived">
                <div className="row-body">
                  <div className="row-title">{t.title}</div>
                  <div className="row-meta"><Owners owners={t.owners} /></div>
                </div>
                <button className="ghost" onClick={() => store.setArchived(t.id, false)}>Restaurar</button>
              </div>
            ))}
          </section>
        )}
      </div>

      <footer className="panel-foot">
        <button className="add" onClick={() => setEditing("new")}><Plus /> Nova tarefa</button>
        <span className="spacer" />
        <SettingsMenu store={store}>
          <button onClick={() => setShowArchived(!showArchived)}>
            Mostrar arquivadas ({archived.length}) <span className={`switch${showArchived ? " on" : ""}`} />
          </button>
          <button onClick={async () => native.copy(await native.dataLocation())}>
            Copiar local dos dados
          </button>
        </SettingsMenu>
      </footer>

      <AnimatePresence>
        {editing && (
          <motion.div className="sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TaskForm
              initial={editing === "new" ? undefined : editing}
              knownOwners={owners}
              defaultOwner={owner}
              onCancel={() => setEditing(null)}
              onSave={(t) => { store.upsertTask(t); setEditing(null); }}
              onDelete={editing === "new" ? undefined : () => { store.removeTask(editing.id); setEditing(null); setExpandedId(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
