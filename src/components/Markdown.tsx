// Leitor de Markdown do Obsidian, enxuto: títulos, parágrafos, listas (com caixas),
// citações/callouts, tabelas, código, links [[nota]] e [texto](url), negrito, itálico,
// destaque ==x==, código inline e #tags. Monta elementos React (sem HTML injetado).
import { Fragment, type ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";

type Item = { text: string; indent: number; checked: boolean | null };
type Block =
  | { t: "h"; level: number; text: string }
  | { t: "p"; lines: string[] }
  | { t: "list"; ordered: boolean; items: Item[] }
  | { t: "quote"; lines: string[] }
  | { t: "code"; lang: string; body: string }
  | { t: "table"; rows: string[][] }
  | { t: "hr" };

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)\s*([\w+-]*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      blocks.push({ t: "code", lang: fence[2].toLowerCase(), body: body.join("\n") });
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ t: "h", level: h[1].length, text: h[2] }); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ t: "hr" }); i++; continue; }
    if (/^\s*>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ t: "quote", lines: q });
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const r = lines[i++].trim();
        if (/^\|?[\s:|-]+\|?$/.test(r)) continue; // linha separadora
        rows.push(r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      }
      blocks.push({ t: "table", rows });
      continue;
    }
    const li = line.match(LIST_RE);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items: Item[] = [];
      while (i < lines.length) {
        const m = lines[i].match(LIST_RE);
        if (!m) {
          // continuação de item (linha indentada)
          if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
            items[items.length - 1].text += ` ${lines[i].trim()}`;
            i++;
            continue;
          }
          break;
        }
        const box = m[3].match(/^\[([ xX])\]\s+(.*)$/);
        items.push({
          indent: Math.floor(m[1].replace(/\t/g, "  ").length / 2),
          checked: box ? box[1].toLowerCase() === "x" : null,
          text: box ? box[2] : m[3],
        });
        i++;
      }
      blocks.push({ t: "list", ordered, items });
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|\s*>|\s*\|)/.test(lines[i]) && !LIST_RE.test(lines[i])) {
      p.push(lines[i++]);
    }
    blocks.push({ t: "p", lines: p });
  }
  return blocks;
}

export interface MdContext {
  /** Nome da nota do link existe no vault? */
  hasNote: (target: string) => boolean;
  openNote: (target: string) => void;
  openUrl: (url: string) => void;
  now: Date;
  onCopied: (what: string) => void;
}

const INLINE_RE =
  /(!?\[\[[^\]]+\]\]|\[[^\]]+\]\([^)\s]+\)|`[^`]+`|\*\*[^*]+?\*\*|__[^_]+?__|==[^=]+==|~~[^~]+~~|(?<![\w*])\*[^*\s](?:[^*]*?[^*\s])?\*(?!\w)|(?<![\w_])_[^_\s](?:[^_]*?[^_\s])?_(?!\w)|(?<![\w/&#])#[A-Za-zÀ-ÿ][\wÀ-ÿ/-]*)/g;

function inline(text: string, ctx: MdContext): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const tok = m[0];
    if (m.index! > last) out.push(text.slice(last, m.index));
    last = m.index! + tok.length;
    const key = k++;
    if (tok.startsWith("![[")) {
      out.push(<span key={key} className="md-embed">📎 {tok.slice(3, -2)}</span>);
    } else if (tok.startsWith("[[")) {
      const [target, alias] = tok.slice(2, -2).split("|");
      const label = alias ?? target.split("#")[0];
      out.push(
        ctx.hasNote(target) ? (
          <a key={key} className="md-link" onClick={() => ctx.openNote(target)}>{label}</a>
        ) : (
          <span key={key} className="md-link missing" title="Nota não encontrada">{label}</span>
        ),
      );
    } else if (tok.startsWith("[")) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      out.push(<a key={key} className="md-ext" title={mm[2]} onClick={() => ctx.openUrl(mm[2])}>{mm[1]}</a>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(<strong key={key}>{inline(tok.slice(2, -2), ctx)}</strong>);
    } else if (tok.startsWith("==")) {
      out.push(<mark key={key}>{inline(tok.slice(2, -2), ctx)}</mark>);
    } else if (tok.startsWith("~~")) {
      out.push(<s key={key}>{inline(tok.slice(2, -2), ctx)}</s>);
    } else if (tok.startsWith("#")) {
      out.push(<span key={key} className="md-tag">{tok}</span>);
    } else {
      out.push(<em key={key}>{inline(tok.slice(1, -1), ctx)}</em>);
    }
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function lines(ls: string[], ctx: MdContext) {
  return ls.map((l, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {inline(l, ctx)}
    </Fragment>
  ));
}

export function Markdown({ source, ctx }: { source: string; ctx: MdContext }) {
  const blocks = parseBlocks(source);
  return (
    <div className="md">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h": {
            const Tag = `h${Math.min(b.level, 4)}` as "h1";
            return <Tag key={i}>{inline(b.text, ctx)}</Tag>;
          }
          case "p":
            return <p key={i}>{lines(b.lines, ctx)}</p>;
          case "hr":
            return <hr key={i} />;
          case "quote": {
            const callout = b.lines[0]?.match(/^\[!(\w+)\][+-]?\s*(.*)$/);
            return (
              <blockquote key={i} className={callout ? `callout c-${callout[1].toLowerCase()}` : undefined}>
                {callout ? (
                  <>
                    <div className="callout-title">{callout[2] || callout[1]}</div>
                    {lines(b.lines.slice(1), ctx)}
                  </>
                ) : (
                  lines(b.lines, ctx)
                )}
              </blockquote>
            );
          }
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i}>
                {b.items.map((it, j) => (
                  <li key={j} style={{ marginLeft: it.indent * 16 }} className={it.checked === null ? undefined : `task${it.checked ? " done" : ""}`}>
                    {it.checked !== null && <span className="box">{it.checked ? "✓" : ""}</span>}
                    {inline(it.text, ctx)}
                  </li>
                ))}
              </Tag>
            );
          }
          case "table":
            return (
              <div key={i} className="md-table">
                <table>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (j === 0 ? <th key={k}>{inline(c, ctx)}</th> : <td key={k}>{inline(c, ctx)}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "code":
            return <CodeBlock key={i} lang={b.lang} body={b.body} now={ctx.now} onCopied={ctx.onCopied} />;
        }
      })}
    </div>
  );
}
