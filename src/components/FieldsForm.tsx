import { motion } from "framer-motion";
import { useState } from "react";
import { fieldLabel, suggest } from "../lib/snippets";

const SHORT_FIELDS = /^(data_inicial|data_final|data|hoje|mes|mês|ano)$/i;

interface Props {
  fields: string[];
  now: Date;
  onCopy: (values: Record<string, string>) => void;
  onCancel: () => void;
}

/** Pede os valores dos {{campos}} antes de copiar, já com sugestões. */
export function FieldsForm({ fields, now, onCopy, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f, suggest(f, now)])),
  );
  const set = (f: string, v: string) => setValues((cur) => ({ ...cur, [f]: v }));

  return (
    <motion.form
      className="fields"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => { e.preventDefault(); onCopy(values); }}
    >
      {fields.map((f, i) =>
        SHORT_FIELDS.test(f) ? (
          <label key={f} className="short">
            <span>{fieldLabel(f)}</span>
            <input autoFocus={i === 0} value={values[f] ?? ""} onChange={(e) => set(f, e.target.value)} />
          </label>
        ) : (
          <label key={f} className="long">
            <span>{fieldLabel(f)}</span>
            <textarea
              autoFocus={i === 0}
              rows={2}
              value={values[f] ?? ""}
              onChange={(e) => set(f, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.ctrlKey && onCopy(values)}
            />
          </label>
        ),
      )}
      <div className="row-actions">
        <span className="spacer" />
        <button type="button" className="ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="primary small">Copiar</button>
      </div>
    </motion.form>
  );
}
