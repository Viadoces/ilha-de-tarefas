import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { native } from "../lib/native";
import { type NoteFile, type Snippet, fill, parseVault } from "../lib/snippets";
import { normalize } from "../lib/tasks";
import type { Store } from "../lib/useData";
import { type Note, matchExcerpt, parseNotes, resolveLink } from "../lib/vault";
import { FieldsForm } from "./FieldsForm";
import { ChevronLeft, ChevronRight, Copy, Doc, External, Refresh, Search } from "./icons";
import { Markdown, type MdContext } from "./Markdown";
import { SettingsMenu } from "./SettingsMenu";

interface Props {
  store: Store;
  now: Date;
  onCopied: (what: string) => void;
}

export function VaultView({ store, now, onCopied }: Props) {
  const configured = store.data?.settings?.vaultPath?.trim() || "";
  const [vault, setVault] = useState<string | null>(null);
  const [files, setFiles] = useState<NoteFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filling, setFilling] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]); // notas abertas no leitor
  const [pathDraft, setPathDraft] = useState(configured);

  const load = useCallback(async () => {
    setError(null);
    try {
      const root = configured || (await native.findVault());
      if (!root) {
        setError("Não encontrei o vault do Obsidian. Informe a pasta na engrenagem.");
        setFiles([]);
        return;
      }
      setVault(root);
      setFiles(await native.readVault(root));
    } catch (e) {
      setError(String(e));
      setFiles([]);
    }
  }, [configured]);

  useEffect(() => { load(); }, [load]);

  const notes = useMemo(() => (files ? parseNotes(files) : []), [files]);
  const snippets = useMemo(() => (files ? parseVault(files) : []), [files]);
  const folders = useMemo(() => [...new Set(notes.map((n) => n.folder))], [notes]);
  const current = history.length ? notes.find((n) => n.path === history[history.length - 1]) : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (filling) setFilling(null);
      else if (history.length) setHistory((h) => h.slice(0, -1));
      else if (expandedId) setExpandedId(null);
      else if (query) setQuery("");
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filling, history.length, expandedId, query]);

  const copySnippet = async (s: Snippet, values?: Record<string, string>) => {
    await native.copy(values ? fill(s.body, values) : s.body);
    setFilling(null);
    onCopied(s.title);
  };

  const openNote = (n: Note) => setHistory((h) => [...h, n.path]);

  const ctx: MdContext = {
    hasNote: (t) => !!resolveLink(notes, t),
    openNote: (t) => {
      const n = resolveLink(notes, t);
      if (n) openNote(n);
    },
    openUrl: (url) => native.openLink(url),
    now,
    onCopied,
  };

  const q = normalize(query.trim());
  const snipKinds = filter === "todos" ? ["sql", "texto"] : filter === "sql" || filter === "texto" ? [filter] : [];
  const visibleSnips = snippets.filter(
    (s) => snipKinds.includes(s.kind) && (!q || normalize(`${s.title} ${s.description} ${s.body}`).includes(q)),
  );
  const visibleNotes = filter === "todos" || folders.includes(filter)
    ? notes.filter((n) => (filter === "todos" || n.folder === filter) && (!q || n.search.includes(q)))
    : [];

  const chips = ["todos", "sql", "texto", ...folders];
  const chipName = (c: string) => (c === "todos" ? "Todos" : c === "sql" ? "SQL" : c === "texto" ? "Textos" : c);

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {current ? (
          <motion.div
            key="reader"
            className="reader"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.16 }}
          >
            <div className="reader-head">
              <button className="icon" onClick={() => setHistory((h) => h.slice(0, -1))} aria-label="Voltar"><ChevronLeft /></button>
              <div className="reader-title">
                <b>{current.name}</b>
                <span>{current.folder}{current.status ? ` · ${current.status}` : ""}</span>
              </div>
              <button className="icon" title="Copiar nota" aria-label="Copiar nota" onClick={async () => { await native.copy(current.body.trim()); onCopied(current.name); }}>
                <Copy />
              </button>
              {vault && (
                <button className="icon" title="Abrir no Obsidian" aria-label="Abrir no Obsidian" onClick={() => native.openInObsidian(vault, current.path)}>
                  <External />
                </button>
              )}
            </div>
            <div className="reader-body" key={current.path}>
              <Markdown source={current.body} ctx={ctx} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className="vault-list"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.16 }}
          >
            <div className="filters">
              <div className="search-box">
                <Search />
                <input
                  autoFocus
                  className="search"
                  placeholder="Buscar no Obsidian…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="filters kinds">
              <div className="chips scroll">
                {chips.map((c) => (
                  <button key={c} className={`chip${filter === c ? " on" : ""}`} onClick={() => setFilter(c)}>{chipName(c)}</button>
                ))}
              </div>
            </div>

            <div className="list">
              {error && <div className="empty error">{error}</div>}
              {files === null && <div className="empty">Lendo o vault…</div>}

              {(["sql", "texto"] as const).map((k) => {
                const group = visibleSnips.filter((s) => s.kind === k);
                if (!group.length) return null;
                return (
                  <section key={k} className="section">
                    <div className="section-title">
                      {k === "sql" ? "Consultas SQL" : "Textos prontos"} <span className="count">{group.length}</span>
                    </div>
                    {group.map((s) => (
                      <SnippetRow
                        key={s.id}
                        s={s}
                        now={now}
                        vault={vault}
                        expanded={expandedId === s.id}
                        filling={filling === s.id}
                        onExpand={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        onStartCopy={() => (s.fields.length ? (setFilling(s.id), setExpandedId(null)) : copySnippet(s))}
                        onCopy={(v) => copySnippet(s, v)}
                        onCancel={() => setFilling(null)}
                      />
                    ))}
                  </section>
                );
              })}

              {folders.map((folder) => {
                const group = visibleNotes.filter((n) => n.folder === folder);
                if (!group.length) return null;
                return (
                  <section key={folder} className="section">
                    <div className="section-title">{folder} <span className="count">{group.length}</span></div>
                    {group.map((n) => (
                      <div key={n.path} className="row note-row" onClick={() => openNote(n)}>
                        <span className="kind kind-note"><Doc /></span>
                        <div className="row-body">
                          <div className="row-title">{n.name}</div>
                          {(matchExcerpt(n, q) ?? n.preview) && <div className="row-desc">{matchExcerpt(n, q) ?? n.preview}</div>}
                        </div>
                        {n.status && <span className={`status st-${normalize(n.status)}`}>{n.status}</span>}
                        <span className="row-chevron"><ChevronRight /></span>
                      </div>
                    ))}
                  </section>
                );
              })}

              {files !== null && !error && !visibleSnips.length && !visibleNotes.length && (
                <div className="empty">{q ? "Nada encontrado." : "Nada por aqui."}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="panel-foot">
        <button className="add" onClick={() => { setFiles(null); load(); }}><Refresh /> Recarregar</button>
        <span className="foot-info">{files ? `${notes.length} notas` : ""}</span>
        <span className="spacer" />
        <SettingsMenu store={store}>
          <div className="menu-field">
            <span>Pasta do vault</span>
            <input
              placeholder={vault ?? "detectar automaticamente"}
              value={pathDraft}
              onChange={(e) => setPathDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && store.setSettings({ vaultPath: pathDraft.trim() })}
              onBlur={() => pathDraft.trim() !== configured && store.setSettings({ vaultPath: pathDraft.trim() })}
            />
          </div>
          <hr />
        </SettingsMenu>
      </footer>
    </>
  );
}

interface RowProps {
  s: Snippet;
  now: Date;
  vault: string | null;
  expanded: boolean;
  filling: boolean;
  onExpand: () => void;
  onStartCopy: () => void;
  onCopy: (values: Record<string, string>) => void;
  onCancel: () => void;
}

function SnippetRow({ s, now, vault, expanded, filling, onExpand, onStartCopy, onCopy, onCancel }: RowProps) {
  return (
    <div className={`row snippet${expanded || filling ? " is-expanded" : ""}`}>
      <span className={`kind kind-${s.kind}`}>{s.kind === "sql" ? "SQL" : "Aa"}</span>
      <div className="row-body" onClick={() => !filling && onExpand()}>
        <div className="row-title">{s.title}</div>
        {!filling && (
          <div className="row-desc">
            {s.description}
            {s.fields.length > 0 && <span className="field-hint"> · {s.fields.map((f) => `{${f}}`).join(" ")}</span>}
          </div>
        )}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              className="snippet-details"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <pre className="code">{s.body}</pre>
              <div className="row-actions">
                <span className="rec path">{s.file}</span>
                {vault && (
                  <button className="ghost" onClick={() => native.openInObsidian(vault, s.file)}>
                    Abrir no Obsidian <External />
                  </button>
                )}
              </div>
            </motion.div>
          )}
          {filling && <FieldsForm fields={s.fields} now={now} onCopy={onCopy} onCancel={onCancel} />}
        </AnimatePresence>
      </div>
      {!filling && (
        <button className="icon copy-btn" onClick={onStartCopy} title="Copiar" aria-label="Copiar">
          <Copy />
        </button>
      )}
    </div>
  );
}
