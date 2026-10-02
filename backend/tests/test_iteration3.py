"""Backend tests for iteration 3 — step notes, replan, PDF export, client documents."""
import io
import struct
import zlib
from datetime import date

import pytest
import requests


# ---------- Helpers ----------
def _tiny_png() -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    idat = chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00"))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


_MIN_PDF = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\nxref\n0 1\n0000000000 65535 f \ntrailer<<>>\n%%EOF\n"


def _ensure_demo(api, base_url):
    api.post(f"{base_url}/api/demo/seed")


def _find_late_project(api, base_url):
    today = date.today().isoformat()
    for p in api.get(f"{base_url}/api/projects").json():
        if p.get("late_count", 0) > 0:
            return p
    # No late project left (replan may have shifted everything).
    # Rebuild late state by unmarking a done step whose end is in the past.
    for p in api.get(f"{base_url}/api/projects").json():
        full = api.get(f"{base_url}/api/projects/{p['id']}").json()
        for s in full["steps"]:
            if s["done"] and s["end"] < today:
                api.patch(f"{base_url}/api/projects/{p['id']}/steps/{s['key']}", json={"done": False})
                return api.get(f"{base_url}/api/projects/{p['id']}").json()
    return None


def _find_on_time_project(api, base_url):
    for p in api.get(f"{base_url}/api/projects").json():
        if p.get("late_count", 0) == 0 and not p.get("archived"):
            return p
    return None


# ---------- Step notes (PATCH) ----------
class TestStepNotes:
    def test_step_comment_actual_end_then_toggle_done(self, api, base_url):
        _ensure_demo(api, base_url)
        clients = api.get(f"{base_url}/api/clients").json()
        pr = api.post(f"{base_url}/api/projects", json={
            "name": "TEST_it3_step_notes", "client_id": clients[0]["id"], "type": "NPD", "mad_date": "2027-08-01",
        })
        assert pr.status_code == 200, pr.text
        pid = pr.json()["id"]
        try:
            key = pr.json()["steps"][0]["key"]

            # 1) set comment + actual_end — done inchangé
            r = api.patch(f"{base_url}/api/projects/{pid}/steps/{key}",
                          json={"comment": "x", "actual_end": "2026-10-01"})
            assert r.status_code == 200, r.text
            s = next(x for x in r.json()["steps"] if x["key"] == key)
            assert s["comment"] == "x"
            assert s["actual_end"] == "2026-10-01"
            assert s["done"] is False, "done should be unchanged"

            # 2) done=True — actual_end conservé
            r = api.patch(f"{base_url}/api/projects/{pid}/steps/{key}", json={"done": True})
            assert r.status_code == 200
            s = next(x for x in r.json()["steps"] if x["key"] == key)
            assert s["done"] is True and s["done_at"]
            assert s["actual_end"] == "2026-10-01", "actual_end must be kept when toggling done=true"

            # 3) done=False — actual_end=null
            r = api.patch(f"{base_url}/api/projects/{pid}/steps/{key}", json={"done": False})
            assert r.status_code == 200
            s = next(x for x in r.json()["steps"] if x["key"] == key)
            assert s["done"] is False
            assert s["actual_end"] is None, "actual_end must be cleared on done=false"

            # 4) comment="" — comment=null
            r = api.patch(f"{base_url}/api/projects/{pid}/steps/{key}", json={"comment": ""})
            assert r.status_code == 200
            s = next(x for x in r.json()["steps"] if x["key"] == key)
            assert s["comment"] is None

            # 5) unknown key → 404
            r = api.patch(f"{base_url}/api/projects/{pid}/steps/does-not-exist", json={"done": True})
            assert r.status_code == 404
        finally:
            api.delete(f"{base_url}/api/projects/{pid}")


# ---------- Replan ----------
class TestReplan:
    def test_preview_late_vs_on_time(self, api, base_url):
        _ensure_demo(api, base_url)
        late = _find_late_project(api, base_url)
        assert late, "demo seed should produce at least one late project"
        r = api.get(f"{base_url}/api/projects/{late['id']}/replan")
        assert r.status_code == 200
        prev = r.json()
        assert prev["delta_days"] > 0, f"expected delta>0, got {prev}"
        assert prev["shifted_count"] > 0
        assert prev["projected_mad"] > prev["mad_date"]

        on_time = _find_on_time_project(api, base_url)
        if on_time and on_time["id"] != late["id"]:
            r2 = api.get(f"{base_url}/api/projects/{on_time['id']}/replan")
            assert r2.status_code == 200
            assert r2.json()["delta_days"] == 0

    def test_apply_replan_on_single_late_project(self, api, base_url):
        _ensure_demo(api, base_url)
        target = _find_late_project(api, base_url)
        assert target, "need at least one late project"
        pid = target["id"]
        old_projected = target["projected_mad"]  # project's current projected before apply
        prev = api.get(f"{base_url}/api/projects/{pid}/replan").json()
        delta = prev["delta_days"]
        assert prev["projected_mad"] == (date.fromisoformat(old_projected) + __import__("datetime").timedelta(days=delta)).isoformat()

        r = api.post(f"{base_url}/api/projects/{pid}/replan")
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["late_count"] == 0
        new_days = (date.fromisoformat(p["projected_mad"]) - date.fromisoformat(old_projected)).days
        assert new_days == delta, f"expected shift of {delta} days, got {new_days}"

        # Second apply must now 400 (no late steps left)
        r2 = api.post(f"{base_url}/api/projects/{pid}/replan")
        assert r2.status_code == 400


# ---------- PDF export ----------
class TestPdfExport:
    def test_export_pdf_basic(self, api, base_url):
        _ensure_demo(api, base_url)
        p = api.get(f"{base_url}/api/projects").json()[0]
        r = requests.get(f"{base_url}/api/projects/{p['id']}/export.pdf")
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF"), r.content[:40]
        cd = r.headers.get("Content-Disposition", "")
        assert "filename=" in cd, cd

    def test_export_pdf_with_photo(self, api, base_url):
        clients = api.get(f"{base_url}/api/clients").json()
        pr = api.post(f"{base_url}/api/projects", json={
            "name": "TEST_it3_pdf", "client_id": clients[0]["id"], "type": "NPD", "mad_date": "2027-09-01",
        })
        pid = pr.json()["id"]
        try:
            s = requests.Session()
            png = _tiny_png()
            up = s.post(f"{base_url}/api/projects/{pid}/photos",
                        files={"file": ("c.png", io.BytesIO(png), "image/png")})
            assert up.status_code == 200, up.text
            r = s.get(f"{base_url}/api/projects/{pid}/export.pdf")
            assert r.status_code == 200
            assert r.content.startswith(b"%PDF")
        finally:
            api.delete(f"{base_url}/api/projects/{pid}")


# ---------- Client documents ----------
class TestClientDocuments:
    def test_pdf_and_image_and_reject_text(self, api, base_url):
        _ensure_demo(api, base_url)
        clients = api.get(f"{base_url}/api/clients").json()
        cid = clients[0]["id"]
        s = requests.Session()

        # PDF
        r = s.post(f"{base_url}/api/clients/{cid}/documents",
                   files={"file": ("brief.pdf", io.BytesIO(_MIN_PDF), "application/pdf")})
        assert r.status_code == 200, r.text
        doc = r.json()["documents"][-1]
        assert doc["kind"] == "pdf"
        pdf_doc = doc

        # Image
        r = s.post(f"{base_url}/api/clients/{cid}/documents",
                   files={"file": ("ref.png", io.BytesIO(_tiny_png()), "image/png")})
        assert r.status_code == 200
        img_doc = r.json()["documents"][-1]
        assert img_doc["kind"] == "image"

        # text/plain rejected
        r = s.post(f"{base_url}/api/clients/{cid}/documents",
                   files={"file": ("x.txt", io.BytesIO(b"hi"), "text/plain")})
        assert r.status_code == 400

        # fetch file
        r = s.get(f"{base_url}/api/files/{pdf_doc['path']}")
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("application/pdf")

        # PUT keeps documents
        before = api.get(f"{base_url}/api/clients/{cid}").json()
        payload = {
            "name": before["name"], "contact": before.get("contact"), "email": before.get("email"),
            "validation_delay_days": before["validation_delay_days"], "notes": before.get("notes"),
        }
        r = api.put(f"{base_url}/api/clients/{cid}", json=payload)
        assert r.status_code == 200
        after_ids = sorted(d["id"] for d in r.json()["documents"])
        before_ids = sorted(d["id"] for d in before["documents"])
        assert before_ids and before_ids == after_ids, "documents lost on PUT"

        # DELETE unknown
        r = api.delete(f"{base_url}/api/clients/{cid}/documents/does-not-exist")
        assert r.status_code == 404

        # DELETE OK
        r = api.delete(f"{base_url}/api/clients/{cid}/documents/{pdf_doc['id']}")
        assert r.status_code == 200
        remaining_ids = [d["id"] for d in r.json()["documents"]]
        assert pdf_doc["id"] not in remaining_ids

        # cleanup remaining image doc
        api.delete(f"{base_url}/api/clients/{cid}/documents/{img_doc['id']}")


# ---------- Regression on projected_mad in list/dashboard ----------
def test_projects_and_dashboard_include_projected_mad(api, base_url):
    _ensure_demo(api, base_url)
    projects = api.get(f"{base_url}/api/projects").json()
    assert projects
    for p in projects:
        assert "projected_mad" in p, f"missing projected_mad in project {p.get('id')}"
    dash = api.get(f"{base_url}/api/dashboard").json()
    for n in dash["next_mad"]:
        assert "projected_mad" in n, f"missing projected_mad in dashboard next_mad {n}"
