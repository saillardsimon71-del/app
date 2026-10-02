"""Backend tests for PGP Glass Tracker API."""
import pytest


# ---------- Health ----------
def test_health(api, base_url):
    r = api.get(f"{base_url}/api/")
    assert r.status_code == 200
    assert "PGP" in r.json()["message"]


# ---------- Settings ----------
def test_settings_get_put(api, base_url):
    r = api.get(f"{base_url}/api/settings")
    assert r.status_code == 200
    orig = r.json()
    assert "order_offset_days" in orig and "default_validation_delay" in orig
    # Round-trip
    r = api.put(f"{base_url}/api/settings", json={"order_offset_days": 50, "default_validation_delay": 12})
    assert r.status_code == 200
    assert r.json()["order_offset_days"] == 50
    # restore
    api.put(f"{base_url}/api/settings", json=orig)


# ---------- Demo seed ----------
def test_demo_seed_idempotent(api, base_url):
    r1 = api.post(f"{base_url}/api/demo/seed")
    assert r1.status_code == 200
    r2 = api.post(f"{base_url}/api/demo/seed")
    assert r2.status_code == 200
    # Second call should create 0 new projects
    assert r2.json()["created"] == 0


# ---------- Planning preview ----------
class TestPlanningPreview:
    def _ref_payload(self, **ov):
        base = {
            "name": "ref", "client_id": "", "type": "NPD", "mad_date": "2026-12-04",
            "glass_cycles": 4, "decor_cycles": 3,
            "preseries_needed": True, "preseries_mode": "sequentielle",
            "packaging_type": "croisillons", "ptf_lead_days": 40,
        }
        base.update(ov)
        return base

    def _client_id(self, api, base_url, delay=10):
        # ensure we have a client with validation_delay=10
        r = api.get(f"{base_url}/api/clients")
        clients = r.json()
        for c in clients:
            if c["validation_delay_days"] == delay:
                return c["id"]
        r = api.post(f"{base_url}/api/clients", json={"name": "TEST_pv", "validation_delay_days": delay})
        return r.json()["id"]

    def test_reference_npd(self, api, base_url):
        cid = self._client_id(api, base_url, 10)
        payload = self._ref_payload(client_id=cid)
        r = api.post(f"{base_url}/api/planning/preview", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["start_date"] == "2026-01-01", f"start={data['start_date']}"
        assert data["total_days"] == 337, f"total_days={data['total_days']}"
        assert data["total_weeks"] == 49, f"total_weeks={data['total_weeks']}"
        lever_keys = {l["key"] for l in data["levers"]}
        assert "glass" in lever_keys and "parallel" in lever_keys
        glass = next(l for l in data["levers"] if l["key"] == "glass")
        parallel = next(l for l in data["levers"] if l["key"] == "parallel")
        # ~7.7 weeks and 7 weeks
        assert abs(glass["gain_weeks"] - 7.7) < 0.3, glass
        assert abs(parallel["gain_weeks"] - 7.0) < 0.3, parallel

    def test_npd_glass2_parallele(self, api, base_url):
        cid = self._client_id(api, base_url, 10)
        payload = self._ref_payload(client_id=cid, glass_cycles=2, preseries_mode="parallele")
        r = api.post(f"{base_url}/api/planning/preview", json=payload)
        data = r.json()
        assert 32 <= data["total_weeks"] <= 36, f"weeks={data['total_weeks']}"

    def test_flk_no_verre_phase(self, api, base_url):
        cid = self._client_id(api, base_url, 10)
        payload = self._ref_payload(client_id=cid, type="FLK", glass_cycles=0)
        r = api.post(f"{base_url}/api/planning/preview", json=payload)
        data = r.json()
        phase_keys = {p["key"] for p in data["phases"]}
        assert "verre" not in phase_keys

    def test_no_preserie_removes_phase(self, api, base_url):
        cid = self._client_id(api, base_url, 10)
        payload = self._ref_payload(client_id=cid, preseries_needed=False)
        r = api.post(f"{base_url}/api/planning/preview", json=payload)
        data = r.json()
        phase_keys = {p["key"] for p in data["phases"]}
        assert "preserie" not in phase_keys

    def test_ptf_uses_ptf_lead_days(self, api, base_url):
        cid = self._client_id(api, base_url, 10)
        payload = self._ref_payload(client_id=cid, packaging_type="ptf", ptf_lead_days=55)
        r = api.post(f"{base_url}/api/planning/preview", json=payload)
        data = r.json()
        emb_pret = next(s for s in data["steps"] if s["key"] == "emb_pret")
        assert emb_pret["duration"] == 55, emb_pret


# ---------- Clients CRUD ----------
class TestClients:
    def test_crud_and_delete_blocked(self, api, base_url):
        # Create
        r = api.post(f"{base_url}/api/clients", json={"name": "TEST_client_crud", "validation_delay_days": 7})
        assert r.status_code == 200
        cid = r.json()["id"]
        # Read
        r = api.get(f"{base_url}/api/clients/{cid}")
        assert r.status_code == 200 and r.json()["validation_delay_days"] == 7
        # Create a project to block delete + verify replan on PUT
        pr = api.post(f"{base_url}/api/projects", json={
            "name": "TEST_proj_del_block", "client_id": cid, "type": "NPD", "mad_date": "2027-06-01",
        })
        assert pr.status_code == 200, pr.text
        pid = pr.json()["id"]
        total_days_before = pr.json()["total_days"]
        # PUT with changed validation_delay should replan
        r = api.put(f"{base_url}/api/clients/{cid}", json={"name": "TEST_client_crud", "validation_delay_days": 20})
        assert r.status_code == 200
        proj_after = api.get(f"{base_url}/api/projects/{pid}").json()
        assert proj_after["total_days"] != total_days_before, "project not replanned on client delay change"
        # DELETE blocked
        r = api.delete(f"{base_url}/api/clients/{cid}")
        assert r.status_code == 400
        # Cleanup: delete project, then client
        api.delete(f"{base_url}/api/projects/{pid}")
        r = api.delete(f"{base_url}/api/clients/{cid}")
        assert r.status_code == 200


# ---------- Projects CRUD ----------
class TestProjects:
    def test_full_lifecycle(self, api, base_url):
        clients = api.get(f"{base_url}/api/clients").json()
        assert clients, "need at least one client (demo seed)"
        cid = clients[0]["id"]
        payload = {"name": "TEST_proj_life", "client_id": cid, "type": "NPD", "mad_date": "2027-05-01"}
        r = api.post(f"{base_url}/api/projects", json=payload)
        assert r.status_code == 200, r.text
        p = r.json()
        pid = p["id"]
        assert "steps" in p and "phases" in p and "progress" in p and "status" in p and "late_count" in p
        # Patch step done
        key = p["steps"][0]["key"]
        r = api.patch(f"{base_url}/api/projects/{pid}/steps/{key}", json={"done": True})
        assert r.status_code == 200
        updated = r.json()
        step = next(s for s in updated["steps"] if s["key"] == key)
        assert step["done"] is True and step["done_at"]
        # PUT keeps done flag on matching keys
        payload2 = {**payload, "glass_cycles": 3}
        r = api.put(f"{base_url}/api/projects/{pid}", json=payload2)
        assert r.status_code == 200
        step_kept = next((s for s in r.json()["steps"] if s["key"] == key), None)
        assert step_kept and step_kept["done"] is True, "done flag lost after PUT replan"
        # Archive toggle
        r = api.post(f"{base_url}/api/projects/{pid}/archive")
        assert r.status_code == 200 and r.json()["archived"] is True
        # Delete
        r = api.delete(f"{base_url}/api/projects/{pid}")
        assert r.status_code == 200
        r = api.get(f"{base_url}/api/projects/{pid}")
        assert r.status_code == 404


# ---------- Dashboard ----------
def test_dashboard(api, base_url):
    r = api.get(f"{base_url}/api/dashboard")
    assert r.status_code == 200
    d = r.json()
    for k in ("active_count", "counts", "late_steps", "upcoming", "pending_validations", "next_mad"):
        assert k in d, f"missing {k}"
    assert isinstance(d["counts"], dict)
