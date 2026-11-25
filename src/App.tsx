import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "./components/Panel";
import { isModalOpen, native } from "./lib/native";
import { buildItems, registerOwners } from "./lib/tasks";
import { useClaude } from "./lib/useClaude";
import { useData } from "./lib/useData";

// Medidas da "ilha" (precisam caber nas janelas definidas em src-tauri/src/lib.rs).
const PILL = { width: 156, height: 27 };
const PILL_HOVER = { width: 200, height: 33 };
const PANEL = { width: 440, height: 620 };
const SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function App() {
  const store = useData();
  const claude = useClaude(store);
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const windowExpanded = useRef(false);
  const openedAt = useRef(0);
  // Colada no topo (notch) ou solta na tela; `up` = painel aberto para cima.
  const [docked, setDocked] = useState(true);
  const [up, setUp] = useState(false);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    native.placement().then((p) => setDocked(p.docked)).catch(console.error);
    return native.onPlaced((p) => {
      setDocked(p.docked);
      if (p.docked) setUp(false);
    });
  }, []);

  useMemo(() => store.data && registerOwners(store.data.tasks), [store.data?.tasks]);

  const summary = useMemo(() => {
    if (!store.data) return { overdue: 0, today: 0 };
    const items = buildItems(store.data, now, now);
    return {
      overdue: items.filter((i) => i.status === "overdue").length,
      today: items.filter((i) => i.status === "today").length,
    };
  }, [store.data, now]);

  const expand = useCallback(async () => {
    if (open) return;
    const p = await native.setExpanded(true).catch((e) => (console.error(e), null));
    if (p) { setUp(p.up); setDocked(p.docked); }
    windowExpanded.current = true;
    openedAt.current = Date.now();
    setHover(false);
    setOpen(true);
  }, [open]);

  const collapse = useCallback(() => {
    setOpen(false);
    setHover(false);
  }, []);

  // Depois de copiar: recolhe e a pílula confirma por um instante.
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number>();
  const onCopied = useCallback(() => {
    collapse();
    setFlash(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 1800);
  }, [collapse]);

  // Clicou fora (a janela perdeu o foco) → recolhe.
  useEffect(
    () => native.onBlur(() => !isModalOpen() && Date.now() - openedAt.current > 400 && collapse()),
    [collapse],
  );

  const wide = hover || flash;
  const size = open ? PANEL : wide ? PILL_HOVER : PILL;
  const radius = open ? 30 : wide ? 17 : 14;
  // Solta na tela, os cantos de cima também arredondam.
  const topRadius = docked ? 0 : radius;
  const tone = summary.overdue ? "red" : summary.today ? "amber" : null;
  const pillText = summary.overdue
    ? `${summary.overdue} atrasada${summary.overdue > 1 ? "s" : ""}`
    : summary.today
      ? `${summary.today} para hoje`
      : "Tudo em dia";

  return (
    <div className={`stage${up ? " up" : ""}`}>
      <motion.div
        className={`island${open ? " is-open" : ""}${docked ? "" : " floating"}`}
        initial={false}
        animate={{
          ...size,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: radius,
          borderTopLeftRadius: topRadius,
          borderTopRightRadius: topRadius,
        }}
        transition={SPRING}
        onHoverStart={() => !open && setHover(true)}
        onHoverEnd={() => setHover(false)}
        // Segurar e mover arrasta a pílula; clique simples abre.
        onPointerDown={(e) => {
          dragged.current = false;
          dragFrom.current = !open && e.button === 0 ? { x: e.screenX, y: e.screenY } : null;
        }}
        onPointerMove={(e) => {
          const from = dragFrom.current;
          if (!from || !(e.buttons & 1) || Math.hypot(e.screenX - from.x, e.screenY - from.y) < 4) return;
          dragFrom.current = null;
          dragged.current = true;
          setHover(false);
          native.dragIsland().catch(console.error);
        }}
        onPointerUp={() => (dragFrom.current = null)}
        onClick={open ? undefined : () => (dragged.current ? (dragged.current = false) : expand())}
        onAnimationComplete={() => {
          // Só encolhe a janela depois que a animação de fechar terminou.
          if (!open && windowExpanded.current) {
            windowExpanded.current = false;
            native.setExpanded(false).then(() => setUp(false)).catch(console.error);
          }
        }}
      >
        {docked && <span className="ear left" />}
        {docked && <span className="ear right" />}
        <div className="island-clip">
          <AnimatePresence>
            {!open && (
              <motion.div
                key="pill"
                className="pill"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.12 } }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
              >
                <AnimatePresence mode="wait">
                  {flash ? (
                    <motion.span
                      key="flash"
                      className="pill-text copied"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      Copiado
                    </motion.span>
                  ) : hover ? (
                    <motion.span
                      key="hover"
                      className="pill-text"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.08 } }}
                    >
                      {pillText}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
                {claude.running && !flash ? (
                  <span className="dot blue" title="Claude respondendo" />
                ) : (
                  tone && !flash && <span className={`dot ${tone}`} />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {open && (
              <motion.div
                key="panel"
                className="panel-wrap"
                style={PANEL}
                initial={{ opacity: 0, filter: "blur(6px)" }}
                animate={{ opacity: 1, filter: "blur(0px)", transition: { delay: 0.08, duration: 0.22 } }}
                exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.1 } }}
              >
                {store.error ? (
                  <div className="fatal">{store.error}</div>
                ) : store.data ? (
                  <Panel store={store} claude={claude} now={now} onClose={collapse} onCopied={onCopied} />
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
