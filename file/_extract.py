from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).parent
out = root / "_extracted.txt"
chunks: list[str] = []
for p in sorted(root.iterdir()):
    if p.suffix.lower() != ".pdf":
        continue
    chunks.append("=" * 80)
    chunks.append(p.name)
    chunks.append("=" * 80)
    try:
        reader = PdfReader(str(p))
        chunks.append(f"pages {len(reader.pages)}")
        for i, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            chunks.append(f"--- page {i} ---")
            chunks.append(text)
    except Exception as exc:
        chunks.append(f"ERR {exc}")
out.write_text("\n".join(chunks), encoding="utf-8")
print(f"wrote {out} chars={out.stat().st_size}")
