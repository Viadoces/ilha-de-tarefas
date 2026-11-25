// Conversa da aba Claude e leitura da saída `--output-format stream-json` do Claude Code.

export type ChatMsg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "tool"; text: string } // "Lendo Projetos.md"
  | { role: "info"; text: string } // "Interrompido."
  | { role: "error"; text: string };

export interface Chat {
  sessionId?: string;
  messages: ChatMsg[];
}

export const MAX_MESSAGES = 300;

export interface Parsed {
  session?: string;
  msgs: ChatMsg[];
  /** O --resume apontou para uma sessão que não existe mais. */
  missingSession?: boolean;
}

const MISSING_RE = /no conversation found/i;
export const isMissingSession = (text: string) => MISSING_RE.test(text);

const fileName = (p: unknown) => (typeof p === "string" ? p.split(/[\\/]/).pop() || p : "");
const cut = (s: unknown, n = 60) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Resumo de uma ferramenta usada pelo Claude, numa linha. `null` = não mostrar. */
export function describeTool(name: string, input: Record<string, unknown> = {}): string | null {
  switch (name) {
    case "Read": return `Lendo ${fileName(input.file_path)}`;
    case "Write": return `Criando ${fileName(input.file_path)}`;
    case "Edit":
    case "MultiEdit": return `Editando ${fileName(input.file_path)}`;
    case "Glob": return `Procurando ${cut(input.pattern)}`;
    case "Grep": return `Buscando “${cut(input.pattern, 40)}”`;
    case "Bash":
    case "PowerShell": return `Rodando ${cut(input.description || input.command)}`;
    case "WebSearch": return `Pesquisando ${cut(input.query)}`;
    case "WebFetch": return `Abrindo ${cut(input.url)}`;
    case "Task":
    case "Agent": return `Delegando: ${cut(input.description)}`;
    case "TodoWrite":
    case "ToolSearch": return null;
    default: return `Usando ${name}`;
  }
}

interface ContentBlock { type: string; text?: string; name?: string; input?: Record<string, unknown> }

/** Traduz uma linha JSON do Claude Code em mensagens da conversa. */
export function parseLine(line: string): Parsed {
  let ev: any;
  try {
    ev = JSON.parse(line);
  } catch {
    return { msgs: [] };
  }
  const out: Parsed = { msgs: [], session: typeof ev.session_id === "string" ? ev.session_id : undefined };

  // Mensagens de subagentes ficam de fora: só poluiriam o painel.
  if (ev.parent_tool_use_id) return out;

  if (ev.type === "assistant") {
    for (const b of (ev.message?.content ?? []) as ContentBlock[]) {
      if (b.type === "text" && b.text?.trim()) out.msgs.push({ role: "assistant", text: b.text.trim() });
      if (b.type === "tool_use" && b.name) {
        const text = describeTool(b.name, b.input);
        if (text) out.msgs.push({ role: "tool", text });
      }
    }
  } else if (ev.type === "result" && (ev.is_error || ev.subtype !== "success")) {
    const text = String(ev.result || (ev.errors ?? []).join("\n") || ev.subtype || "Erro desconhecido.");
    if (isMissingSession(text)) out.missingSession = true;
    else out.msgs.push({ role: "error", text: withHint(text) });
  }
  return out;
}

/** Mensagem de erro para quando o processo termina mal sem ter mandado um `result`. */
export function exitError(code: number | null, stderr: string): string {
  const tail = stderr.trim().split(/\r?\n/).filter(Boolean).slice(-4).join("\n");
  return withHint(tail || `O Claude Code terminou com erro (código ${code ?? "?"}).`);
}

function withHint(text: string) {
  return /log ?in|authenticat|api key|unauthori[sz]ed/i.test(text)
    ? `${text}\n\nAbra um terminal, rode \`claude\` e faça login. Depois tente de novo.`
    : text;
}
