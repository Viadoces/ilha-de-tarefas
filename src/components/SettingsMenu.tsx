import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useEffect, useState } from "react";
import { native } from "../lib/native";
import type { Store } from "../lib/useData";
import { Gear } from "./icons";

/** Engrenagem do rodapé. `children` são os itens próprios de cada aba. */
export function SettingsMenu({ store, children }: { store: Store; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [autostart, setAutostart] = useState<boolean | null>(null);

  useEffect(() => {
    native.autostart.get().then(setAutostart).catch(() => setAutostart(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button className={`icon${open ? " on" : ""}`} onClick={() => setOpen(!open)} aria-label="Ajustes">
        <Gear />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="menu"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
          >
            {children}
            {autostart !== null && (
              <button onClick={async () => { await native.autostart.set(!autostart); setAutostart(!autostart); }}>
                Iniciar com o Windows <span className={`switch${autostart ? " on" : ""}`} />
              </button>
            )}
            <button onClick={() => { setOpen(false); native.resetPosition(true).catch(console.error); }}>
              Voltar a ilha para o topo
            </button>
            <hr />
            <button className="danger-text" onClick={async () => { await store.flush(); await native.quit(); }}>
              Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
