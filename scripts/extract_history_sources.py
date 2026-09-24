import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree
from pypdf import PdfReader

def clean(text: str) -> str:
    text = text.replace("\u00ad", "").replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()

def native_path(path: Path):
    resolved = str(path.resolve())
    return "\\\\?\\" + resolved if len(resolved) >= 248 and not resolved.startswith("\\\\?\\") else resolved

def pdf_text(path: Path):
    reader = PdfReader(native_path(path))
    pages = [clean(page.extract_text() or "") for page in reader.pages]
    return "\n\n".join(pages), len(pages)

def docx_text(path: Path):
    paragraphs = []
    with zipfile.ZipFile(native_path(path)) as archive:
        root = ElementTree.fromstring(archive.read("word/document.xml"))
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    for paragraph in root.iter(ns + "p"):
        parts = []
        for node in paragraph.iter():
            if node.tag == ns + "t" and node.text:
                parts.append(node.text)
            elif node.tag == ns + "tab":
                parts.append("\t")
            elif node.tag == ns + "br":
                parts.append("\n")
        value = clean("".join(parts))
        if value:
            paragraphs.append(value)
    return "\n".join(paragraphs), None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--grades", nargs="+", default=["9.Klasse", "10.Klasse", "12.Klasse"])
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    inventory = []
    for grade in args.grades:
        grade_number = int(grade.split(".")[0])
        for path in sorted(p for p in (args.source / grade).rglob("*") if p.suffix.lower() in {".pdf", ".docx"}):
            rel = path.relative_to(args.source)
            try:
                text, pages = pdf_text(path) if path.suffix.lower() == ".pdf" else docx_text(path)
                status, error = ("ok" if text else "empty"), None
            except Exception as exc:
                text, pages, status, error = "", None, "error", str(exc)
            digest = hashlib.sha1(rel.as_posix().encode("utf-8")).hexdigest()[:12]
            target = args.output / str(grade_number) / f"{digest}.txt"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding="utf-8")
            inventory.append({"grade": grade_number, "file": rel.as_posix(), "text_file": target.relative_to(args.output).as_posix(), "type": path.suffix.lower()[1:], "pages": pages, "characters": len(text), "status": status, "error": error})
    (args.output / "inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": len(inventory), "ok": sum(i["status"] == "ok" for i in inventory), "empty": sum(i["status"] == "empty" for i in inventory), "errors": sum(i["status"] == "error" for i in inventory), "characters": sum(i["characters"] for i in inventory)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
