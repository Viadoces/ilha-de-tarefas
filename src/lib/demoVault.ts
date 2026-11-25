// Notas de exemplo usadas só na pré-visualização no navegador (npm run dev).
import type { NoteFile } from "./snippets";

export const demoVault: NoteFile[] = [
  {
    path: "03_RECURSOS/Consulta de exemplo.md",
    content: `---
tipo: recurso
---

# Consulta de exemplo

Consulta de demonstração com período em campos preenchíveis.

## SQL
\`\`\`sql
select nroempresa, sum(vlrsaidaoutras) as total
  from consinco.maxv_abcmovtobase
 where dtaentradasaida between to_date('{{data_inicial}}', 'dd/mm/yyyy')
                           and to_date('{{data_final}}', 'dd/mm/yyyy')
 group by nroempresa
\`\`\`
`,
  },
  {
    path: "03_RECURSOS/Textos prontos.md",
    content: `# Textos prontos

Intro ignorada.

## Resposta do ponto
ATRASO. DESCONTAR

## Cobrar notas de água e energia
Assunto: Notas fiscais de água e energia — {{mes}}

Ainda não recebemos as notas de {{mes}} das lojas:
{{lojas}}
`,
  },
];
