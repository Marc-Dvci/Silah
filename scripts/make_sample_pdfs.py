"""Write the three fictional sample premarital genetic reports for the Silah demo.

Output (relative to the project root):
    public/samples/aisha-khalfan-sample.pdf
    public/samples/rashid-khalfan-sample.pdf
    public/samples/noor-hamdan-sample.pdf

The text mirrors the code blocks in docs/SAMPLE_REPORTS.md; keep the two in step.
Every person, laboratory and signature here is invented.

Usage:
    python scripts/make_sample_pdfs.py
"""

import os
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_DIR = os.path.join(ROOT, "public", "samples")

PAGE_W, PAGE_H = A4
MARGIN_X = 15 * mm
MARGIN_TOP = 15 * mm
MARGIN_BOTTOM = 20 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

RED = colors.HexColor("#A3392B")
INDIGO = colors.HexColor("#2B3A67")
INK = colors.HexColor("#1F2330")
MUTED = colors.HexColor("#4A5060")
GREY_TEXT = colors.HexColor("#6E7380")
GRID = colors.HexColor("#D8DCE8")
HEAD_BG = colors.HexColor("#ECEEF5")
WATERMARK = colors.HexColor("#F0F0F0")

TABLE_FONT = "Helvetica"
TABLE_BOLD = "Helvetica-Bold"
TABLE_SIZE = 8
CELL_PAD = 2.5

BAND_TEXT = "SAMPLE: fictional person, not a real result"
LAB_NAME = "Al Waha Genomics Laboratory (fictional)"
REPORT_TITLE = "Premarital Genetic Screening Report"
TEST_LINE = (
    "Test: Premarital genetic screening, DoH panel "
    "(Premarital Screening Standard V3, Appendix 12), 563 genes"
)
TABLE_HEAD = [
    "Gene",
    "Variant (HGVS)",
    "Protein",
    "Zygosity",
    "Classification",
    "Associated condition",
]
SENSITIVITY_LINE = (
    "Analytical sensitivity: the panel detects 95% of disease-causing "
    "single-nucleotide variants and small insertions or deletions in the panel genes."
)
TARGETED_LINE = (
    "Targeted analysis of the partner's sample for your familial variant: 99% sensitivity."
)
NEGATIVE_LINE = (
    "This test does not detect all genetic disorders. "
    "A negative result reduces but does not remove the chance of being a carrier."
)
NOT_ALL_LINE = "This test does not detect all genetic disorders."
REPORTED_BY = "Reported by: Dr. Sample Geneticist (fictional)"
DISCLAIMER = "Fictional sample for the Silah demo. No real person, laboratory or result."

REPORTS = [
    {
        "file": "aisha-khalfan-sample.pdf",
        "fields": [
            "Patient name: Aisha Khalfan (sample)",
            "Sex: Female",
            "Date of birth: 1999-03-14",
            "Report date: 2026-10-20",
            TEST_LINE,
            "Partner: Rashid Khalfan (sample)",
            "Declared relationship: First cousins",
        ],
        "variants": [
            ["HBB", "NM_000518.5:c.20A>T", "p.Glu7Val (HbS)", "Heterozygous",
             "Pathogenic", "Sickle cell disease"],
            ["GJB2", "NM_004004.6:c.35delG", "p.Gly12fs", "Heterozygous",
             "Pathogenic", "Nonsyndromic hearing loss"],
            ["MEFV", "NM_000243.3:c.442G>C", "p.Glu148Gln", "Heterozygous",
             "Uncertain significance (VUS)", "Familial Mediterranean fever"],
        ],
        "couple": [
            "Couple status: AT RISK (not compatible)",
            "Both partners carry a pathogenic variant in: HBB",
            "Partner's variant in the shared gene: HBB c.92+5G>C (beta-plus thalassaemia)",
            "Your partner was tested for your other carrier variants and none was found in: GJB2",
        ],
        "methods": [SENSITIVITY_LINE, TARGETED_LINE, NEGATIVE_LINE],
    },
    {
        "file": "rashid-khalfan-sample.pdf",
        "fields": [
            "Patient name: Rashid Khalfan (sample)",
            "Sex: Male",
            "Date of birth: 1996-07-02",
            "Report date: 2026-10-20",
            TEST_LINE,
            "Partner: Aisha Khalfan (sample)",
            "Declared relationship: First cousins",
        ],
        "variants": [
            ["HBB", "NM_000518.5:c.92+5G>C", "IVS-I-5 (beta-plus)", "Heterozygous",
             "Pathogenic", "Beta-thalassaemia"],
            ["CFTR", "NM_000492.4:c.1521_1523del", "p.Phe508del", "Heterozygous",
             "Pathogenic", "Cystic fibrosis"],
        ],
        "couple": [
            "Couple status: AT RISK (not compatible)",
            "Both partners carry a pathogenic variant in: HBB",
            "Partner's variant in the shared gene: HBB c.20A>T (HbS)",
            "Your partner was tested for your other carrier variants and none was found in: CFTR",
        ],
        "methods": [SENSITIVITY_LINE, TARGETED_LINE, NEGATIVE_LINE],
    },
    {
        "file": "noor-hamdan-sample.pdf",
        "fields": [
            "Patient name: Noor Hamdan (sample)",
            "Sex: Female",
            "Date of birth: 2001-11-30",
            "Report date: 2026-09-08",
            TEST_LINE,
            "Partner: Hamad Obaid (sample)",
            "Declared relationship: Not related",
        ],
        "variants": [
            ["CYP21A2", "NM_000500.9:c.293-13C>G", "IVS2-13", "Heterozygous",
             "Pathogenic", "Congenital adrenal hyperplasia"],
        ],
        "couple": [
            "Couple status: COMPATIBLE",
            "Certificate wording: No risk for either the other partner or children to be carrier or diseased",
            "Your partner was tested for your carrier variants and none was found in: CYP21A2",
        ],
        "methods": [NOT_ALL_LINE],
    },
]


def _styles():
    return {
        "band": ParagraphStyle(
            "band", fontName="Helvetica-Bold", fontSize=9, leading=12,
            textColor=RED, spaceAfter=8,
        ),
        "lab": ParagraphStyle(
            "lab", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=INK,
        ),
        "title": ParagraphStyle(
            "title", fontName="Helvetica", fontSize=11, leading=14, textColor=MUTED,
        ),
        "field": ParagraphStyle(
            "field", fontName="Helvetica", fontSize=9, leading=13, textColor=INK,
        ),
        "section": ParagraphStyle(
            "section", fontName="Helvetica-Bold", fontSize=10, leading=13,
            textColor=INK, spaceBefore=12, spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "body", fontName="Helvetica", fontSize=9, leading=12.5,
            textColor=INK, spaceAfter=4,
        ),
    }


def _column_widths(rows):
    """Column widths shared by all three reports, so no cell wraps and the layout matches."""
    needs = []
    for i, head in enumerate(TABLE_HEAD):
        widths = [stringWidth(head, TABLE_BOLD, TABLE_SIZE)]
        widths += [stringWidth(row[i], TABLE_FONT, TABLE_SIZE) for row in rows]
        needs.append(max(widths) + 2 * CELL_PAD)
    total = sum(needs)
    if total > CONTENT_W:
        raise ValueError(f"table needs {total:.1f} pt, content width is {CONTENT_W:.1f} pt")
    slack = (CONTENT_W - total) / len(needs)
    return [n + slack for n in needs]


def _variant_table(rows, widths):
    table = Table([TABLE_HEAD] + rows, colWidths=widths, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), TABLE_BOLD),
        ("FONTNAME", (0, 1), (-1, -1), TABLE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), TABLE_SIZE),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
        ("GRID", (0, 0), (-1, -1), 0.5, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), CELL_PAD),
        ("RIGHTPADDING", (0, 0), (-1, -1), CELL_PAD),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]))
    return table


def _story(rep, st, widths):
    for line in rep["fields"]:
        if stringWidth(line, "Helvetica", 9) > CONTENT_W:
            raise ValueError(f"field line would wrap: {line!r}")

    story = [
        Paragraph(escape(BAND_TEXT), st["band"]),
        Paragraph(escape(LAB_NAME), st["lab"]),
        Paragraph(escape(REPORT_TITLE), st["title"]),
        HRFlowable(width="100%", thickness=0.8, color=INDIGO, spaceBefore=5, spaceAfter=8),
    ]
    story += [Paragraph(escape(line), st["field"]) for line in rep["fields"]]
    story.append(Paragraph("Results: variants reported", st["section"]))
    story.append(_variant_table(rep["variants"], widths))
    story.append(Paragraph("Couple analysis", st["section"]))
    story += [Paragraph(escape(line), st["body"]) for line in rep["couple"]]
    story.append(Paragraph("Methods and limitations", st["section"]))
    story += [Paragraph(escape(line), st["body"]) for line in rep["methods"]]
    story.append(Spacer(1, 10))
    story.append(Paragraph(escape(REPORTED_BY), st["body"]))
    return story


def _draw_watermark(canv, doc):
    """Drawn first on the page, so it sits behind the real text in the content stream."""
    canv.saveState()
    canv.setFillColor(WATERMARK)
    canv.setFont("Helvetica-Bold", 120)
    canv.translate(PAGE_W / 2, PAGE_H / 2)
    canv.rotate(35)
    canv.drawCentredString(0, -42, "SAMPLE")
    canv.restoreState()


def _draw_footer(canv, doc):
    canv.saveState()
    canv.setFont("Helvetica", 7.5)
    canv.setFillColor(GREY_TEXT)
    canv.drawString(MARGIN_X, 12 * mm, DISCLAIMER)
    canv.restoreState()


def build_pdf(rep, widths, st):
    path = os.path.join(OUT_DIR, rep["file"])
    doc = BaseDocTemplate(
        path,
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title="Sample premarital genetic report (fictional)",
        author="Silah demo",
        subject="Fictional sample report for the Silah demo",
        creator="scripts/make_sample_pdfs.py",
        invariant=1,
    )
    frame = Frame(
        MARGIN_X, MARGIN_BOTTOM, CONTENT_W, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="body",
    )
    doc.addPageTemplates([
        PageTemplate(id="report", frames=[frame], onPage=_draw_watermark, onPageEnd=_draw_footer),
    ])
    doc.build(_story(rep, st, widths))
    return path


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    all_rows = [row for rep in REPORTS for row in rep["variants"]]
    widths = _column_widths(all_rows)
    st = _styles()
    for rep in REPORTS:
        path = build_pdf(rep, widths, st)
        print(f"{path} {os.path.getsize(path)} bytes")


if __name__ == "__main__":
    main()
