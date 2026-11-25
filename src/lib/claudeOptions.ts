// Opções da aba Claude. "" = deixar o Claude Code decidir.
export type Option = { id: string; name: string; hint?: string };

export const MODELS: Option[] = [
  { id: "", name: "Padrão" },
  { id: "fable", name: "Fable" },
  { id: "opus", name: "Opus" },
  { id: "sonnet", name: "Sonnet" },
  { id: "haiku", name: "Haiku" },
];

export const EFFORTS: Option[] = [
  { id: "", name: "Padrão" },
  { id: "low", name: "Baixo" },
  { id: "medium", name: "Médio" },
  { id: "high", name: "Alto" },
  { id: "xhigh", name: "Muito alto" },
  { id: "max", name: "Máximo" },
];

/** Sem configuração = acesso total (a primeira escolha do projeto). */
export const DEFAULT_PERMISSION = "bypassPermissions";
export const PERMISSIONS: Option[] = [
  { id: "bypassPermissions", name: "Acesso total", hint: "Edita arquivos e roda comandos sem perguntar" },
  { id: "auto", name: "Automático", hint: "Faz o que é seguro e bloqueia o arriscado" },
  { id: "acceptEdits", name: "Editar notas", hint: "Lê e edita arquivos, sem comandos arriscados" },
  { id: "dontAsk", name: "Só leitura", hint: "Só lê e busca, não altera nada" },
];

export const nameOf = (list: Option[], id: string) => list.find((o) => o.id === id)?.name ?? id;
