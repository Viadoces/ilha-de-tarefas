// Lê consultas SQL e textos prontos das notas do Obsidian.
// - Toda nota com bloco ```sql vira uma consulta (um item por bloco).
// - A nota "Textos prontos" vira um texto por seção "## título".
// - {{campo}} no corpo vira um campo a preencher antes de copiar.

export interface Snippet {
  id: string;
  kind: "sql" | "texto";
  title: string;
  description: string;
  body: string;
  file: string; // caminho relativo ao vault, com "/"
  fields: string[];
}

export interface NoteFile {
  path: string;
  content: string;
}

export const TEXTOS_NOTE = "Textos prontos";
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const FIELD_RE = /\{\{\s*([^{}\s]+)\s*\}\}/g;

export function fieldsOf(body: string) {
  return [...new Set([...body.matchAll(FIELD_RE)].map((m) => m[1]))];
}

export function fill(body: string, values: Record<string, string>) {
  return body.replace(FIELD_RE, (whole, name: string) => values[name] ?? whole);
}

const stripFrontmatter = (s: string) => s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
const noteName = (path: string) => path.split("/").pop()!.replace(/\.md$/i, "");

/** Primeiro parágrafo de texto comum (sem título, citação, lista ou código). */
function firstParagraph(text: string) {
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const t = block.trim();
    if (!t || /^(#|>|```|---|\||- |\* |\d+\. )/.test(t)) continue;
    const plain = t.replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2").replace(/[*_`]/g, "").replace(/\s+/g, " ");
    return plain.length > 180 ? `${plain.slice(0, 177)}…` : plain;
  }
  return "";
}

export function parseNote(file: string, raw: string): Snippet[] {
  const text = stripFrontmatter(raw).replace(/\r\n/g, "\n");
  const name = noteName(file);

  if (name === TEXTOS_NOTE) {
    return text
      .split(/^## +/m)
      .slice(1)
      .map((section, i) => {
        const nl = section.indexOf("\n");
        const title = (nl < 0 ? section : section.slice(0, nl)).trim();
        const body = (nl < 0 ? "" : section.slice(nl + 1)).replace(/\n-{3,}\s*$/, "").trim();
        return { title, body, i };
      })
      .filter((s) => s.title && s.body)
      .map(({ title, body, i }) => ({
        id: `${file}#${i}`,
        kind: "texto" as const,
        title,
        description: body.split("\n").find((l) => l.trim())!.trim(),
        body,
        file,
        fields: fieldsOf(body),
      }));
  }

  const blocks = [...text.matchAll(/^```sql[^\n]*\n([\s\S]*?)^```/gm)];
  const description = firstParagraph(text.replace(/^# .*$/m, ""));
  return blocks.map((m, i) => {
    const before = text.slice(0, m.index);
    const heading = [...before.matchAll(/^#{2,6} +(.+)$/gm)].pop()?.[1].trim();
    const title = blocks.length > 1 && heading && heading.toUpperCase() !== "SQL" ? `${name} — ${heading}` : name;
    const body = m[1].replace(/\s+$/, "");
    return { id: `${file}#${i}`, kind: "sql" as const, title, description, body, file, fields: fieldsOf(body) };
  });
}

export function parseVault(files: NoteFile[]) {
  return files
    .flatMap((f) => parseNote(f.path, f.content))
    .sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title, "pt-BR") : a.kind === "sql" ? -1 : 1));
}

const pad = (n: number) => String(n).padStart(2, "0");
const br = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/**
 * Valor sugerido para um campo. O ciclo de movimentação vai do dia 26 ao 25
 * (09/2026 = 26/08 a 25/09); sugere o ciclo que contém hoje.
 */
export function suggest(field: string, today: Date): string {
  const end = today.getDate() > 25
    ? new Date(today.getFullYear(), today.getMonth() + 1, 25)
    : new Date(today.getFullYear(), today.getMonth(), 25);
  const start = new Date(end.getFullYear(), end.getMonth() - 1, 26);
  switch (field.toLowerCase()) {
    case "data_inicial": return br(start);
    case "data_final": return br(end);
    case "mes": case "mês": return `${MESES[end.getMonth()]}/${end.getFullYear()}`;
    case "hoje": case "data": return br(today);
    case "ano": return String(end.getFullYear());
    default: return "";
  }
}

/** "data_inicial" → "Data inicial" */
export const fieldLabel = (f: string) => (f.charAt(0).toUpperCase() + f.slice(1)).replace(/_/g, " ");
