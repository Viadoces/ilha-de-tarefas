import { motion } from "framer-motion";
import { useState } from "react";
import { type Item, ownerColor, recurrenceLabel, relativeLabel } from "../lib/tasks";

interface Props {
  item: Item;
  today: Date;
  periodName: string;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onNote: (note: string) => void;
  onEdit: () => void;
  onArchive: () => void;
}

export function Owners({ owners }: { owners: string[] }) {
  return (
    <>
      {owners.map((o) => (
        <span key={o} className="owner">
          <i style={{ background: ownerColor(o) }} />
          {o}
        </span>
      ))}
    </>
  );
}

export function TaskRow({ item, today, periodName, expanded, onToggle, onExpand, onNote, onEdit, onArchive }: Props) {
  const { task, entry, status, due } = item;
  const done = status === "done";
  const [note, setNote] = useState(entry?.note ?? "");
  const undated = !due;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className={`row s-${status}${expanded ? " is-expanded" : ""}`}
    >
      <button className="check" onClick={onToggle} aria-label={done ? "Desmarcar" : "Concluir"}>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <circle cx="12" cy="12" r="9.5" className="check-ring" />
          <motion.circle
            cx="12" cy="12" r="9.5" className="check-fill"
            initial={false}
            animate={{ scale: done ? 1 : 0, opacity: done ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
          />
          <motion.path
            d="M7.5 12.3l3 3 6-6.3" className="check-mark"
            pathLength={1}
            strokeDasharray="1 1"
            initial={false}
            animate={{ strokeDashoffset: done ? 0 : 1 }}
            transition={{ duration: 0.22, delay: done ? 0.06 : 0 }}
          />
        </svg>
      </button>

      <div className="row-body" onClick={onExpand}>
        <div className="row-title">{task.title}</div>
        <div className="row-meta">
          <Owners owners={task.owners} />
          {undated && <span className="rec">· {recurrenceLabel(task.recurrence)}</span>}
          {entry?.note && !expanded && <span className="row-note">{entry.note}</span>}
        </div>

        {expanded && (
          <motion.div
            className="row-details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              className="note-input"
              rows={2}
              placeholder={`Nota de ${periodName}…`}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                onNote(e.target.value);
              }}
            />
            <div className="row-actions">
              <span className="rec">{recurrenceLabel(task.recurrence)}</span>
              <button className="ghost" onClick={onEdit}>Editar</button>
              <button className="ghost" onClick={onArchive}>Arquivar</button>
            </div>
          </motion.div>
        )}
      </div>

      {due && (
        <div className="row-due">
          <b>{due.getDate()}</b>
          <small>{done ? "feito" : relativeLabel(due, today)}</small>
        </div>
      )}
    </motion.div>
  );
}
