"""Tests for photo (croquis) endpoints and regression on PUT preserving photos.

Grouped into a single class so the state (uploaded photo) survives inside one worker
when pytest-xdist is used.
"""
import io
import struct
import zlib

import pytest
import requests


def _tiny_png() -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    idat = chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00"))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


@pytest.fixture(scope="module")
def session():
    return requests.Session()


@pytest.fixture(scope="module")
def project_id(session, base_url):
    clients = session.get(f"{base_url}/api/clients").json()
    assert clients, "need at least one client (demo seed)"
    cid = clients[0]["id"]
    r = session.post(f"{base_url}/api/projects",
                     json={"name": "TEST_photos_proj", "client_id": cid, "type": "NPD", "mad_date": "2027-06-01"},
                     headers={"Content-Type": "application/json"})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield pid
    session.delete(f"{base_url}/api/projects/{pid}")


class TestPhotos:
    """Full photo lifecycle in a single class so order is preserved."""

    def test_1_upload_png_ok(self, session, base_url, project_id, request):
        png = _tiny_png()
        files = {"file": ("croquis.png", io.BytesIO(png), "image/png")}
        r = session.post(f"{base_url}/api/projects/{project_id}/photos", files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "photos" in data and len(data["photos"]) >= 1
        last = data["photos"][-1]
        for k in ("id", "path", "name", "content_type", "size"):
            assert k in last, f"missing {k} in photo"
        assert last["content_type"] == "image/png"
        assert last["size"] == len(png)
        assert last["name"] == "croquis.png"
        request.config.cache.set("last_photo", last)

    def test_2_reject_text_content_type(self, session, base_url, project_id):
        files = {"file": ("hack.txt", io.BytesIO(b"hello"), "text/plain")}
        r = session.post(f"{base_url}/api/projects/{project_id}/photos", files=files)
        assert r.status_code == 400, r.text

    def test_3_reject_empty_file(self, session, base_url, project_id):
        files = {"file": ("empty.png", io.BytesIO(b""), "image/png")}
        r = session.post(f"{base_url}/api/projects/{project_id}/photos", files=files)
        assert r.status_code == 400, r.text

    def test_4_fetch_ok(self, session, base_url, project_id, request):
        photo = request.config.cache.get("last_photo", None)
        assert photo, "upload test must run first"
        r = session.get(f"{base_url}/api/files/{photo['path']}")
        assert r.status_code == 200, r.text
        assert r.headers.get("Content-Type", "").startswith("image/png")
        assert len(r.content) == photo["size"]

    def test_5_fetch_unknown_404(self, session, base_url):
        r = session.get(f"{base_url}/api/files/autre/chemin/does-not-exist.png")
        assert r.status_code == 404

    def test_6_put_keeps_photos(self, session, base_url, project_id):
        before = session.get(f"{base_url}/api/projects/{project_id}").json()
        assert len(before["photos"]) >= 1
        payload = {
            "name": before["name"], "client_id": before["client_id"], "type": before["type"],
            "mad_date": before["mad_date"], "glass_cycles": 3,
        }
        r = session.put(f"{base_url}/api/projects/{project_id}", json=payload,
                        headers={"Content-Type": "application/json"})
        assert r.status_code == 200
        after = r.json()
        before_ids = sorted(p["id"] for p in before["photos"])
        after_ids = sorted(p["id"] for p in after["photos"])
        assert before_ids == after_ids, f"photos lost on PUT: before={before_ids} after={after_ids}"

    def test_7_delete_unknown_404(self, session, base_url, project_id):
        r = session.delete(f"{base_url}/api/projects/{project_id}/photos/does-not-exist")
        assert r.status_code == 404

    def test_8_delete_ok(self, session, base_url, project_id, request):
        photo = request.config.cache.get("last_photo", None)
        assert photo, "upload test must run first"
        r = session.delete(f"{base_url}/api/projects/{project_id}/photos/{photo['id']}")
        assert r.status_code == 200
        data = r.json()
        assert all(ph["id"] != photo["id"] for ph in data["photos"]), "photo not removed"


# Quick regression on general endpoints after photo flow
def test_regression_endpoints(base_url):
    s = requests.Session()
    assert s.get(f"{base_url}/api/dashboard").status_code == 200
    assert s.get(f"{base_url}/api/projects").status_code == 200
    assert s.get(f"{base_url}/api/clients").status_code == 200
    clients = s.get(f"{base_url}/api/clients").json()
    assert clients
    r = s.post(f"{base_url}/api/planning/preview", json={
        "name": "reg", "client_id": clients[0]["id"], "type": "NPD", "mad_date": "2027-05-01",
    }, headers={"Content-Type": "application/json"})
    assert r.status_code == 200
