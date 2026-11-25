// Todas as notas do vault: pasta, status do frontmatter, prévia e busca.
import type { NoteFile } from "./snippets";
import { normalize } from "./tasks";

export interface Note {
  path: string; // relativo ao vault, com "/"
  name: string; // nome do arquivo sem .md
  folder: string; // rótulo da pasta de primeiro nível ("Projetos", "Raiz"…)
  folderKey: string; // pasta original, para ordenar ("01_PROJETOS")
  status?: string;
  body: string; // conteúdo sem frontmatter
  preview: string;
  search: string; // nome + conteúdo, normalizado
}

const FOLDER_NAMES: Record<string, string> = { AREAS: "Áreas", AREA: "Área" };

/** "01_PROJETOS" → "Projetos"; "04_Arquivos" → "Arquivos". */
export function folderLabel(dir: string) {
  const clean = dir.replace(/^\d+[_\s-]*/, "");
  const upper = clean.toUpperCase();
  if (FOLDER_NAMES[upper]) return FOLDER_NAMES[upper];
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function frontmatter(raw: string) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {} as Record<string, string>, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

/** Primeira linha de texto comum da nota, sem marcação. */
function previewOf(body: string) {
  for (const raw of body.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || /^(#|```|---|\||>\s*$)/.test(t)) continue;
    const plain = t
      .replace(/^[-*>]\s+(\[.\]\s+)?/, "")
      .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`]/g, "");
    if (plain) return plain.length > 140 ? `${plain.slice(0, 137)}…` : plain;
  }
  return "";
}

export function parseNotes(files: NoteFile[]): Note[] {
  return files
    .map((f) => {
      const { meta, body } = frontmatter(f.content.replace(/\r\n/g, "\n"));
      const parts = f.path.split("/");
      const name = parts[parts.length - 1].replace(/\.md$/i, "");
      const folderKey = parts.length > 1 ? parts[0] : "";
      return {
        path: f.path,
        name,
        folder: folderKey ? folderLabel(folderKey) : "Raiz",
        folderKey: folderKey || "~", // raiz por último
        status: meta.status || undefined,
        body,
        preview: previewOf(body),
        search: normalize(`${name}\n${body}`),
      };
    })
    .sort(
      (a, b) =>
        Number(a.folderKey === "~") - Number(b.folderKey === "~") ||
        a.folderKey.localeCompare(b.folderKey) ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
}

/** Acha a nota de um [[link]] (pelo nome ou caminho, sem diferenciar maiúsculas). */
export function resolveLink(notes: Note[], target: string): Note | undefined {
  const t = normalize(target.split("#")[0].replace(/\.md$/i, "").trim());
  if (!t) return undefined;
  return notes.find((n) => normalize(n.name) === t) ?? notes.find((n) => normalize(n.path.replace(/\.md$/i, "")).endsWith(t));
}

/** Trecho em volta da primeira ocorrência da busca no conteúdo. */
export function matchExcerpt(note: Note, q: string) {
  if (!q || normalize(note.name).includes(q)) return null;
  const lines = note.body.split("\n");
  const line = lines.find((l) => normalize(l).includes(q));
  if (!line) return null;
  const plain = line.trim().replace(/[*_`#>]/g, "").replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2");
  const idx = normalize(plain).indexOf(q);
  const start = Math.max(0, idx - 40);
  return (start > 0 ? "…" : "") + plain.slice(start, start + 120);
}
