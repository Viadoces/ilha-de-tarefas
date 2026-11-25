import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_PERMISSION, EFFORTS, MODELS, nameOf, type Option, PERMISSIONS } from "../lib/claudeOptions";
import type { Settings } from "../lib/tasks";
import type { Store } from "../lib/useData";
import { Check } from "./icons";

/** Modelo, esforço e permissão da aba Claude. Valem a partir da próxima mensagem. */
export function ModelPicker({ store }: { store: Store }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const s = store.data?.settings;
  const model = s?.claudeModel ?? "";
  const effort = s?.claudeEffort ?? "";
  const permission = s?.claudePermission || DEFAULT_PERMISSION;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); setOpen(false); }
    };
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const label = [model ? nameOf(MODELS, model) : "Modelo", effort && nameOf(EFFORTS, effort)].filter(Boolean).join(" · ");

  const group = (title: string, list: Option[], value: string, key: keyof Settings) => (
    <div className="picker-group">
      <div className="menu-label">{title}</div>
      {list.map((o) => (
        <button key={o.id || "padrao"} onClick={() => store.setSettings({ [key]: o.id })}>
          <span className="picker-opt">
            {o.name}
            {o.hint && <small>{o.hint}</small>}
          </span>
          {value === o.id && <Check />}
        </button>
      ))}
    </div>
  );

  return (
    <div className="picker" ref={box}>
      <button
        className={`chip${open ? " is-open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={`Permissão: ${nameOf(PERMISSIONS, permission)}`}
      >
        <i className={`perm perm-${permission}`} />
        {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="menu picker-menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
          >
            <div className="picker-cols">
              {group("Modelo", MODELS, model, "claudeModel")}
              {group("Esforço", EFFORTS, effort, "claudeEffort")}
            </div>
            <hr />
            {group("Permissão", PERMISSIONS, permission, "claudePermission")}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Lista de permissões para o onboarding. */
export function PermissionChoice({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="perm-choices">
      {PERMISSIONS.map((o) => (
        <button key={o.id} className={`choice${value === o.id ? " on" : ""}`} onClick={() => onChange(o.id)}>
          <span className="radio">{value === o.id && <Check />}</span>
          <span className="choice-text"><b>{o.name}</b><small>{o.hint}</small></span>
        </button>
      ))}
    </div>
  );
}
