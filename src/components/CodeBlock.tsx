import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { native } from "../lib/native";
import { fieldsOf, fill } from "../lib/snippets";
import { FieldsForm } from "./FieldsForm";
import { Copy } from "./icons";

interface Props {
  lang: string;
  body: string;
  now: Date;
  onCopied: (what: string) => void;
}

/** Bloco de código dentro de uma nota, com botão de copiar (e campos, se houver). */
export function CodeBlock({ lang, body, now, onCopied }: Props) {
  const [filling, setFilling] = useState(false);
  const fields = fieldsOf(body);

  const copy = async (values?: Record<string, string>) => {
    await native.copy(values ? fill(body, values) : body);
    setFilling(false);
    onCopied(lang ? `bloco ${lang}` : "bloco de código");
  };

  return (
    <div className="md-code">
      <div className="md-code-bar">
        <span>{lang === "dataview" ? "dataview · só funciona no Obsidian" : lang || "código"}</span>
        <button className="icon" title="Copiar" aria-label="Copiar" onClick={() => (fields.length ? setFilling(!filling) : copy())}>
          <Copy />
        </button>
      </div>
      <pre className="code">{body}</pre>
      <AnimatePresence>
        {filling && <FieldsForm fields={fields} now={now} onCopy={copy} onCancel={() => setFilling(false)} />}
      </AnimatePresence>
    </div>
  );
}
