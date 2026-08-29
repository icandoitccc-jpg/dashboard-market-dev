from pathlib import Path
import sys

from docx import Document
from docx.document import Document as _Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P


def iter_blocks(parent):
    parent_elm = parent.element.body if isinstance(parent, _Document) else parent._tc
    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


def extract(path: Path) -> str:
    doc = Document(path)
    out = [f"# {path.name}"]
    for block in iter_blocks(doc):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if text:
                out.append(f"\n[P:{block.style.name}] {text}")
        else:
            out.append("\n[TABLE]")
            for row in block.rows:
                cells = [" ".join(c.text.split()) for c in row.cells]
                out.append(" | ".join(cells))
    return "\n".join(out)


if __name__ == "__main__":
    for item in sys.argv[1:]:
        path = Path(item)
        print(extract(path))
        print("\n\n" + "=" * 100 + "\n")
