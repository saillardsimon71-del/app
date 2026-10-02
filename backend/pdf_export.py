"""Export PDF « version client » du rétroplanning (reportlab)."""
import io
from datetime import date

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from planning import PHASES

BRAND = colors.HexColor("#4A6B53")
BRAND_SOFT = colors.HexColor("#E7F0E9")
MUTED = colors.HexColor("#8E8E93")
RULE = colors.HexColor("#E5E5EA")
TYPE_LABEL = {"NPD": "Nouveau produit", "DUP": "Duplication", "FLK": "Décor seul", "MLD": "Moule ajusté"}
MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]


def fdate(iso: str) -> str:
    d = date.fromisoformat(iso[:10])
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def _image_flowable(data: bytes, max_w: float, max_h: float):
    try:
        im = PILImage.open(io.BytesIO(data))
        im = im.convert("RGB")
    except Exception:  # noqa: BLE001 — format non décodable (HEIC…)
        return None
    im.thumbnail((1400, 1400))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=82)
    buf.seek(0)
    w, h = im.size
    scale = min(max_w / w, max_h / h)
    return Image(buf, width=w * scale, height=h * scale)


def build_pdf(project: dict, photos: list[bytes]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"Rétroplanning — {project['name']}", author="PGP Glass")
    ss = getSampleStyleSheet()
    brand = ParagraphStyle("brand", parent=ss["Normal"], fontName="Helvetica-Bold", fontSize=10, textColor=BRAND, leading=12)
    right = ParagraphStyle("right", parent=ss["Normal"], fontSize=9, textColor=MUTED, alignment=TA_RIGHT)
    title = ParagraphStyle("title", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, alignment=0, spaceAfter=2)
    sub = ParagraphStyle("sub", parent=ss["Normal"], fontSize=10.5, textColor=MUTED, leading=14)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, textColor=BRAND, spaceBefore=10, spaceAfter=4)
    cell = ParagraphStyle("cell", parent=ss["Normal"], fontSize=9, leading=11)
    cell_muted = ParagraphStyle("cellm", parent=cell, textColor=MUTED)
    cell_bold = ParagraphStyle("cellb", parent=cell, fontName="Helvetica-Bold")

    story = []
    story.append(Table([[Paragraph("PGP GLASS", brand), Paragraph(f"Rétroplanning · édité le {fdate(date.today().isoformat())}", right)]],
                       colWidths=[90 * mm, 84 * mm], style=TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                                                        ("LINEBELOW", (0, 0), (-1, 0), 0.6, BRAND),
                                                                        ("BOTTOMPADDING", (0, 0), (-1, 0), 6)])))
    story.append(Spacer(1, 10))
    story.append(Paragraph(project["name"], title))
    meta = f"{project['client_name']} · {project['type']} — {TYPE_LABEL.get(project['type'], project['type'])}"
    if project.get("code"):
        meta += f" · Réf. {project['code']}"
    story.append(Paragraph(meta, sub))
    story.append(Spacer(1, 10))

    projected = project.get("projected_mad")
    kpis = [["Mise à disposition", "Démarrage", "Durée"],
            [fdate(project["mad_date"]), fdate(project["start_date"]), f"{project['total_weeks']} semaines"]]
    if projected and projected > project["mad_date"]:
        delta = (date.fromisoformat(projected) - date.fromisoformat(project["mad_date"])).days
        kpis[0][0] = "MAD cible / prévue"
        kpis[1][0] = f"{fdate(project['mad_date'])} / {fdate(projected)} (+{delta} j)"
    kt = Table([[Paragraph(x, cell_muted) for x in kpis[0]], [Paragraph(x, cell_bold) for x in kpis[1]]],
               colWidths=[70 * mm, 52 * mm, 52 * mm])
    kt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), BRAND_SOFT), ("ROUNDEDCORNERS", [6]),
                            ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
                            ("LEFTPADDING", (0, 0), (-1, -1), 10)]))
    story.append(kt)

    story.append(Paragraph("Planning par phase", h2))
    steps = project["steps"]
    for key, name in PHASES:
        ps = [s for s in steps if s["phase"] == key]
        if not ps:
            continue
        rows = [[Paragraph(name, cell_bold), Paragraph("Début", cell_muted), Paragraph("Fin", cell_muted), Paragraph("", cell_muted)]]
        for s in ps:
            tag = "Validation client" if s.get("client_validation") else ("Jalon" if s.get("milestone") else "")
            label = s["name"] + (" ✓" if s.get("done") else "")
            rows.append([Paragraph(label, cell), Paragraph(fdate(s["start"]), cell), Paragraph(fdate(s["end"]), cell), Paragraph(tag, cell_muted)])
        t = Table(rows, colWidths=[86 * mm, 26 * mm, 26 * mm, 36 * mm], repeatRows=1)
        style = [("LINEBELOW", (0, 0), (-1, 0), 0.6, BRAND), ("LINEBELOW", (0, 1), (-1, -1), 0.3, RULE),
                 ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                 ("LEFTPADDING", (0, 0), (0, -1), 0)]
        for i, s in enumerate(ps, start=1):
            if s.get("client_validation"):
                style.append(("TEXTCOLOR", (3, i), (3, i), BRAND))
        t.setStyle(TableStyle(style))
        story.append(t)
        story.append(Spacer(1, 6))

    images = [f for f in (_image_flowable(b, 80 * mm, 70 * mm) for b in photos) if f is not None]
    if images:
        story.append(Paragraph("Photos & croquis", h2))
        rows = [images[i:i + 2] for i in range(0, len(images), 2)]
        for r in rows:
            while len(r) < 2:
                r.append("")
        gt = Table(rows, colWidths=[87 * mm, 87 * mm])
        gt.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                                ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
        story.append(gt)

    doc.build(story)
    return buf.getvalue()
