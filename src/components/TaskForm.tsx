import { motion } from "framer-motion";
import { useState } from "react";
import { DIAS, MESES, type Recurrence, type Task, ownerColor } from "../lib/tasks";
import { newTaskId } from "../lib/useData";

interface Props {
  initial?: Task;
  knownOwners: string[];
  defaultOwner?: string | null;
  onSave: (t: Task) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

type Kind = Recurrence["kind"];
const KINDS: [Kind, string][] = [
  ["monthly", "Dia do mês"],
  ["weekly", "Semanal"],
  ["yearly", "Anual"],
  ["event", "Sem dia fixo"],
];

export function TaskForm({ initial, knownOwners, defaultOwner, onSave, onCancel, onDelete }: Props) {
  const r = initial?.recurrence;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [owners, setOwners] = useState<string[]>(initial?.owners ?? (defaultOwner ? [defaultOwner] : []));
  const [newOwner, setNewOwner] = useState("");
  const [kind, setKind] = useState<Kind>(r?.kind ?? "monthly");
  const [day, setDay] = useState(r?.kind === "monthly" ? r.day : new Date().getDate());
  const [weekday, setWeekday] = useState(r?.kind === "weekly" ? r.weekday : 5);
  const [month, setMonth] = useState<number | null>(r?.kind === "yearly" ? r.month : null);
  const [label, setLabel] = useState(r?.kind === "event" ? r.label : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const allOwners = [...new Set([...knownOwners, ...owners])];
  const toggleOwner = (o: string) =>
    setOwners((cur) => (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]));
  const addOwner = () => {
    const name = newOwner.trim();
    if (name && !owners.includes(name)) setOwners([...owners, name]);
    setNewOwner("");
  };

  const recurrence = (): Recurrence => {
    switch (kind) {
      case "monthly": return { kind, day: Math.min(31, Math.max(1, day || 1)) };
      case "weekly": return { kind, weekday };
      case "yearly": return { kind, month };
      case "event": return { kind, label: label.trim() || "Sem data" };
    }
  };

  const canSave = title.trim().length > 0;
  const save = () =>
    canSave &&
    onSave({
      id: initial?.id ?? newTaskId(),
      title: title.trim(),
      owners: newOwner.trim() ? [...owners, newOwner.trim()] : owners,
      recurrence: recurrence(),
      archived: initial?.archived ?? false,
    });

  return (
    <motion.div
      className="form"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
      }}
    >
      <div className="form-head">{initial ? "Editar tarefa" : "Nova tarefa"}</div>

      <textarea
        autoFocus
        className="form-title"
        rows={2}
        placeholder="O que precisa ser feito?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className="form-label">Responsável</label>
      <div className="chips wrap">
        {allOwners.map((o) => (
          <button key={o} className={`chip${owners.includes(o) ? " on" : ""}`} onClick={() => toggleOwner(o)}>
            <i style={{ background: ownerColor(o) }} />
            {o}
          </button>
        ))}
        <input
          className="chip-input"
          placeholder="+ outro"
          value={newOwner}
          onChange={(e) => setNewOwner(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.ctrlKey && (e.preventDefault(), addOwner())}
          onBlur={addOwner}
        />
      </div>

      <label className="form-label">Repetição</label>
      <div className="segmented">
        {KINDS.map(([k, name]) => (
          <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
            {k === kind && <motion.span layoutId="seg" className="seg-bg" />}
            <span>{name}</span>
          </button>
        ))}
      </div>

      <div className="form-rec">
        {kind === "monthly" && (
          <>
            Todo dia
            <input type="number" min={1} max={31} value={day} onChange={(e) => setDay(+e.target.value)} />
            do mês
          </>
        )}
        {kind === "weekly" && (
          <>
            Toda
            <select value={weekday} onChange={(e) => setWeekday(+e.target.value)}>
              {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </>
        )}
        {kind === "yearly" && (
          <>
            Uma vez por ano, até
            <select value={month ?? ""} onChange={(e) => setMonth(e.target.value ? +e.target.value : null)}>
              <option value="">sem mês definido</option>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </>
        )}
        {kind === "event" && (
          <input
            className="wide"
            placeholder="Quando? Ex.: quando fechar o fiscal"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        )}
      </div>

      <div className="form-actions">
        {onDelete &&
          (confirmDelete ? (
            <button className="danger" onClick={onDelete}>Confirmar exclusão</button>
          ) : (
            <button className="ghost danger-text" onClick={() => setConfirmDelete(true)}>Excluir</button>
          ))}
        <span className="spacer" />
        <button className="ghost" onClick={onCancel}>Cancelar</button>
        <button className="primary" disabled={!canSave} onClick={save}>Salvar</button>
      </div>
    </motion.div>
  );
}
