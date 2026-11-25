"""Converte a planilha de tarefas mensais em src/seed.json (dados iniciais do app).

Uso: python scripts/importar_planilha.py "tarefas mensais q faltam fazer.xlsx"
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tarefas mensais q faltam fazer.xlsx"
ws = openpyxl.load_workbook(xlsx).active

header_month = str(ws["D1"].value or "").strip().lower()
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro"]
today = date.today()
note_period = (f"{today.year}-{MESES.index(header_month) + 1:02d}"
               if header_month in MESES else f"{today.year}-{today.month:02d}")


def recurrence(raw, title):
    if raw is None:
        if "semanal" in title.lower():
            return {"kind": "event", "label": "Semanal"}
        return {"kind": "event", "label": "Sem data"}
    if isinstance(raw, (int, float)):
        return {"kind": "monthly", "day": int(raw)}
    s = str(raw).strip()
    low = s.lower()
    m = re.match(r"^(\d{1,2})\b", s)
    if m:
        return {"kind": "monthly", "day": int(m.group(1))}
    if low == "mensal":
        return {"kind": "event", "label": "Mensal"}
    if low == "anual":
        return {"kind": "yearly", "month": None}
    if "sexta" in low:
        return {"kind": "weekly", "weekday": 5}
    label = s.replace("quanado", "quando").replace(" , ", ", ")
    return {"kind": "event", "label": label[:1].upper() + label[1:]}


tasks, log = [], {}
for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=1):
    title, raw_date, owner, note = (list(row) + [None] * 4)[:4]
    if not title or not owner:
        continue
    title = " ".join(str(title).split())
    archived = bool(re.search(r"n[aã]o fazemos mais", f"{title} {raw_date}", re.I))
    owners = [o.strip() for o in str(owner).split("/") if o.strip()]
    tid = f"t{i:03d}"
    tasks.append({
        "id": tid,
        "title": title,
        "owners": owners,
        "recurrence": recurrence(raw_date if not archived or isinstance(raw_date, int) else None, title),
        "archived": archived,
    })
    if note:
        log[tid] = {note_period: {"done": False, "note": str(note).strip()}}

out = ROOT / "src" / "seed.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({"version": 1, "tasks": tasks, "log": log}, ensure_ascii=False, indent=2),
               encoding="utf-8")
print(f"{len(tasks)} tarefas ({sum(t['archived'] for t in tasks)} arquivadas) -> {out}")
