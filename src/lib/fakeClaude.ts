// Simula o Claude Code na pré-visualização no navegador (npm run dev), para mexer na interface.
type Handler = (p: any) => void;
const handlers: Record<"line" | "done", Set<Handler>> = { line: new Set(), done: new Set() };
let timers: number[] = [];
let lastRun = 0;

const emit = (ev: "line" | "done", p: unknown) => handlers[ev].forEach((h) => h(p));

export const fakeClaude = {
  on(ev: "line" | "done", cb: Handler) {
    handlers[ev].add(cb);
    return () => handlers[ev].delete(cb);
  },
  send(run: number, prompt: string) {
    lastRun = run;
    const session = "00000000-0000-4000-8000-000000000000";
    const steps: unknown[] = [
      { type: "system", subtype: "init", session_id: session },
      { type: "assistant", session_id: session, message: { content: [{ type: "tool_use", name: "Grep", input: { pattern: prompt.slice(0, 30) } }] } },
      { type: "assistant", session_id: session, message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "C:/vault/03_RECURSOS/Consulta de exemplo.md" } }] } },
      {
        type: "assistant",
        session_id: session,
        message: {
          content: [{
            type: "text",
            text: `Encontrei isto em [[Consulta de exemplo]]:\n\n- A consulta soma **vlrsaidaoutras** por empresa\n- Usa os campos \`data_inicial\` e \`data_final\`\n\nQuer que eu crie uma nota com o resumo?`,
          }],
        },
      },
      { type: "result", subtype: "success", is_error: false, session_id: session },
    ];
    timers = steps.map((s, i) => window.setTimeout(() => emit("line", { run, line: JSON.stringify(s) }), 500 * (i + 1)));
    timers.push(window.setTimeout(() => emit("done", { run, code: 0, stderr: "" }), 500 * (steps.length + 1)));
  },
  stop() {
    timers.forEach(clearTimeout);
    timers = [];
    window.setTimeout(() => emit("done", { run: lastRun, code: 1, stderr: "" }));
  },
};
