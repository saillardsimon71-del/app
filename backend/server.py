from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict
from typing import Annotated, Literal, Optional
from datetime import datetime, timezone, date, timedelta
from bson import ObjectId
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from planning import compute_plan, lever_suggestions, summarize, TYPE_DEFAULTS  # noqa: E402
from storage import APP_NAME, get_object, init_storage, put_object  # noqa: E402

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude={"id"})
        data.pop("_id", None)
        return data

    def out(self) -> dict:
        return self.model_dump(by_alias=False)


# ---------- Models ----------
class Settings(BaseModel):
    order_offset_days: int = Field(default=45, ge=0, le=365)
    default_validation_delay: int = Field(default=10, ge=1, le=120)


class ClientIn(BaseModel):
    name: str = Field(min_length=1)
    contact: Optional[str] = None
    email: Optional[str] = None
    validation_delay_days: int = Field(default=10, ge=1, le=120)
    notes: Optional[str] = None


class Client(BaseDocument, ClientIn):
    created_at: str = Field(default_factory=now_iso)


class Step(BaseModel):
    key: str
    phase: str
    name: str
    start: str
    end: str
    duration: int
    milestone: bool = False
    client_validation: bool = False
    done: bool = False
    done_at: Optional[str] = None


ProjectType = Literal["NPD", "DUP", "FLK", "MLD"]


class Photo(BaseModel):
    id: str
    path: str
    name: str
    content_type: str
    size: int
    created_at: str = Field(default_factory=now_iso)


class ProjectIn(BaseModel):
    name: str = Field(min_length=1)
    code: Optional[str] = None
    client_id: str
    type: ProjectType
    mad_date: date
    moq: Optional[int] = None
    tech_specs: Optional[str] = None
    preseries_needed: bool = True
    preseries_mode: Literal["sequentielle", "parallele"] = "sequentielle"
    packaging_type: Literal["croisillons", "barquettes", "ptf"] = "croisillons"
    ptf_lead_days: int = Field(default=40, ge=1, le=365)
    glass_cycles: int = Field(default=4, ge=0, le=8)
    decor_cycles: int = Field(default=3, ge=0, le=8)
    notes: Optional[str] = None
    archived: bool = False

    def plan_input(self) -> dict:
        d = self.model_dump()
        d["mad_date"] = self.mad_date.isoformat()
        if self.type == "FLK":
            d["glass_cycles"] = 0
        return d


class Project(BaseDocument):
    name: str
    code: Optional[str] = None
    client_id: str
    type: ProjectType
    mad_date: str
    moq: Optional[int] = None
    tech_specs: Optional[str] = None
    preseries_needed: bool = True
    preseries_mode: str = "sequentielle"
    packaging_type: str = "croisillons"
    ptf_lead_days: int = 40
    glass_cycles: int = 4
    decor_cycles: int = 3
    notes: Optional[str] = None
    archived: bool = False
    photos: list[Photo] = []
    steps: list[Step] = []
    start_date: str
    total_days: int
    total_weeks: int
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class StepPatch(BaseModel):
    done: bool


# ---------- Helpers ----------
async def get_settings() -> Settings:
    doc = await db.settings.find_one({"_id": "global"})
    return Settings(**{k: v for k, v in (doc or {}).items() if k != "_id"})


async def get_client(cid: str) -> Client:
    if not ObjectId.is_valid(cid):
        raise HTTPException(404, "Client introuvable")
    doc = await db.clients.find_one({"_id": ObjectId(cid)})
    if not doc:
        raise HTTPException(404, "Client introuvable")
    return Client.from_mongo(doc)


async def plan_for(data: ProjectIn) -> tuple[dict, Client, Settings]:
    c = await get_client(data.client_id)
    s = await get_settings()
    return compute_plan(data.plan_input(), c.validation_delay_days, s.order_offset_days), c, s


async def project_out(p: Project, client_name: Optional[str] = None) -> dict:
    if client_name is None:
        cdoc = await db.clients.find_one({"_id": ObjectId(p.client_id)}) if ObjectId.is_valid(p.client_id) else None
        client_name = cdoc["name"] if cdoc else "—"
    steps = [s.model_dump() for s in p.steps]
    return {**p.out(), "client_name": client_name, **summarize(steps, date.today())}


async def load_project(pid: str) -> Project:
    if not ObjectId.is_valid(pid):
        raise HTTPException(404, "Projet introuvable")
    doc = await db.projects.find_one({"_id": ObjectId(pid)})
    if not doc:
        raise HTTPException(404, "Projet introuvable")
    return Project.from_mongo(doc)


async def all_projects_out(include_archived: bool = True) -> list[dict]:
    clients = {str(c["_id"]): c["name"] async for c in db.clients.find({}, {"name": 1})}
    q = {} if include_archived else {"archived": False}
    docs = await db.projects.find(q).sort("mad_date", 1).to_list(1000)
    return [await project_out(Project.from_mongo(d), clients.get(d["client_id"], "—")) for d in docs]


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "PGP Glass Tracker API"}


@api_router.get("/settings")
async def read_settings():
    return (await get_settings()).model_dump()


@api_router.put("/settings")
async def update_settings(s: Settings):
    await db.settings.update_one({"_id": "global"}, {"$set": s.model_dump()}, upsert=True)
    return s.model_dump()


@api_router.get("/type-defaults")
async def type_defaults():
    return TYPE_DEFAULTS


# Clients
@api_router.get("/clients")
async def list_clients():
    counts = {}
    async for d in db.projects.find({}, {"client_id": 1}):
        counts[d["client_id"]] = counts.get(d["client_id"], 0) + 1
    docs = await db.clients.find().sort("name", 1).to_list(1000)
    return [{**Client.from_mongo(d).out(), "project_count": counts.get(str(d["_id"]), 0)} for d in docs]


@api_router.get("/clients/{cid}")
async def read_client(cid: str):
    return (await get_client(cid)).out()


@api_router.post("/clients")
async def create_client(data: ClientIn):
    c = Client(**data.model_dump())
    res = await db.clients.insert_one(c.to_mongo())
    c.id = str(res.inserted_id)
    return c.out()


async def replan_client_projects(cid: str):
    docs = await db.projects.find({"client_id": cid}).to_list(1000)
    for d in docs:
        p = Project.from_mongo(d)
        data = ProjectIn(**{k: v for k, v in p.model_dump().items() if k in ProjectIn.model_fields})
        await save_replan(p, data)


@api_router.put("/clients/{cid}")
async def update_client(cid: str, data: ClientIn):
    old = await get_client(cid)
    await db.clients.update_one({"_id": ObjectId(cid)}, {"$set": data.model_dump()})
    if old.validation_delay_days != data.validation_delay_days:
        await replan_client_projects(cid)
    return (await get_client(cid)).out()


@api_router.delete("/clients/{cid}")
async def delete_client(cid: str):
    await get_client(cid)
    if await db.projects.count_documents({"client_id": cid}):
        raise HTTPException(400, "Ce client a des projets. Supprimez-les d'abord.")
    await db.clients.delete_one({"_id": ObjectId(cid)})
    return {"ok": True}


# Planning preview
@api_router.post("/planning/preview")
async def planning_preview(data: ProjectIn):
    plan, c, s = await plan_for(data)
    levers = lever_suggestions(data.plan_input(), c.validation_delay_days, s.order_offset_days)
    today = date.today()
    start = date.fromisoformat(plan["start_date"])
    summary = summarize(plan["steps"], today)
    return {**plan, "levers": levers, "phases": summary["phases"],
            "start_in_past_days": max(0, (today - start).days),
            "validation_delay_days": c.validation_delay_days}


# Projects
@api_router.get("/projects")
async def list_projects():
    return await all_projects_out()


@api_router.get("/projects/{pid}")
async def read_project(pid: str):
    return await project_out(await load_project(pid))


@api_router.post("/projects")
async def create_project(data: ProjectIn):
    plan, c, _ = await plan_for(data)
    d = data.plan_input()
    p = Project(**{**d, **plan, "steps": [Step(**s) for s in plan["steps"]]})
    res = await db.projects.insert_one(p.to_mongo())
    p.id = str(res.inserted_id)
    return await project_out(p, c.name)


async def save_replan(p: Project, data: ProjectIn) -> Project:
    plan, _, _ = await plan_for(data)
    prev = {s.key: s for s in p.steps}
    steps = []
    for s in plan["steps"]:
        old = prev.get(s["key"])
        steps.append(Step(**s, done=old.done if old else False, done_at=old.done_at if old else None))
    d = data.plan_input()
    new = Project(**{**d, **plan, "steps": steps, "photos": p.photos, "created_at": p.created_at, "updated_at": now_iso()})
    await db.projects.replace_one({"_id": ObjectId(p.id)}, new.to_mongo())
    new.id = p.id
    return new


@api_router.put("/projects/{pid}")
async def update_project(pid: str, data: ProjectIn):
    p = await load_project(pid)
    return await project_out(await save_replan(p, data))


@api_router.patch("/projects/{pid}/steps/{key}")
async def patch_step(pid: str, key: str, body: StepPatch):
    p = await load_project(pid)
    found = False
    for s in p.steps:
        if s.key == key:
            s.done = body.done
            s.done_at = now_iso() if body.done else None
            found = True
    if not found:
        raise HTTPException(404, "Étape introuvable")
    await db.projects.update_one({"_id": ObjectId(pid)},
                                 {"$set": {"steps": [s.model_dump() for s in p.steps], "updated_at": now_iso()}})
    return await project_out(p)


@api_router.post("/projects/{pid}/archive")
async def toggle_archive(pid: str):
    p = await load_project(pid)
    await db.projects.update_one({"_id": ObjectId(pid)}, {"$set": {"archived": not p.archived}})
    return await project_out(await load_project(pid))


@api_router.delete("/projects/{pid}")
async def delete_project(pid: str):
    await load_project(pid)
    await db.projects.delete_one({"_id": ObjectId(pid)})
    return {"ok": True}


# Photos (croquis, idées client) — stockage objet
MAX_PHOTO_BYTES = 15 * 1024 * 1024
EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif"}


@api_router.post("/projects/{pid}/photos")
async def upload_photo(pid: str, file: UploadFile = File(...)):
    p = await load_project(pid)
    ctype = (file.content_type or "").lower()
    if ctype not in EXT:
        raise HTTPException(400, "Format non pris en charge (JPEG, PNG, WebP ou HEIC)")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Fichier vide")
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(400, "Photo trop lourde (15 Mo max)")
    photo_id = uuid.uuid4().hex
    path = f"{APP_NAME}/uploads/{pid}/{photo_id}.{EXT[ctype]}"
    try:
        result = await run_in_threadpool(put_object, path, data, ctype)
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 500
        if status == 402:
            raise HTTPException(402, "Stockage épuisé : rechargez votre solde pour ajouter des photos")
        logger.exception("upload failed")
        raise HTTPException(502, "Le stockage des photos est indisponible")
    photo = Photo(id=photo_id, path=result["path"], name=file.filename or f"{photo_id}.{EXT[ctype]}",
                  content_type=ctype, size=len(data))
    await db.projects.update_one({"_id": ObjectId(pid)},
                                 {"$push": {"photos": photo.model_dump()}, "$set": {"updated_at": now_iso()}})
    p.photos.append(photo)
    return await project_out(p)


@api_router.delete("/projects/{pid}/photos/{photo_id}")
async def delete_photo(pid: str, photo_id: str):
    p = await load_project(pid)
    if not any(ph.id == photo_id for ph in p.photos):
        raise HTTPException(404, "Photo introuvable")
    await db.projects.update_one({"_id": ObjectId(pid)},
                                 {"$pull": {"photos": {"id": photo_id}}, "$set": {"updated_at": now_iso()}})
    return await project_out(await load_project(pid))


@api_router.get("/files/{path:path}")
async def read_file(path: str):
    if not path.startswith(f"{APP_NAME}/"):
        raise HTTPException(404, "Fichier introuvable")
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except requests.HTTPError:
        raise HTTPException(404, "Fichier introuvable")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=31536000, immutable"})


# Dashboard
@api_router.get("/dashboard")
async def dashboard():
    projects = await all_projects_out(include_archived=False)
    today = date.today()
    late_steps, upcoming = [], []
    for p in projects:
        for s in p["steps"]:
            if s["done"]:
                continue
            end = date.fromisoformat(s["end"])
            item = {"project_id": p["id"], "project_name": p["name"], "client_name": p["client_name"],
                    "project_type": p["type"], **s}
            if end < today:
                late_steps.append({**item, "days_late": (today - end).days})
            elif end <= today + timedelta(days=21):
                upcoming.append({**item, "days_left": (end - today).days})
    late_steps.sort(key=lambda x: -x["days_late"])
    upcoming.sort(key=lambda x: x["end"])
    counts = {k: sum(1 for p in projects if p["status"] == k)
              for k in ("en_retard", "a_risque", "dans_les_temps", "a_venir", "termine")}
    validations = sum(1 for u in upcoming if u["client_validation"])
    return {
        "active_count": len([p for p in projects if p["status"] != "termine"]),
        "counts": counts,
        "late_steps": late_steps[:30],
        "upcoming": upcoming[:30],
        "pending_validations": validations,
        "next_mad": [{"id": p["id"], "name": p["name"], "client_name": p["client_name"], "mad_date": p["mad_date"],
                      "type": p["type"], "status": p["status"], "progress": p["progress"]}
                     for p in projects if p["status"] != "termine"][:5],
    }


# Demo data
@api_router.post("/demo/seed")
async def seed_demo():
    today = date.today()
    demo_clients = [
        ClientIn(name="Maison Lumière Parfums", contact="Claire Martin", email="claire@maisonlumiere.fr",
                 validation_delay_days=10),
        ClientIn(name="Atelier Nord Cosmétiques", contact="Hugo Lefèvre", email="hugo@ateliernord.fr",
                 validation_delay_days=5),
    ]
    ids = []
    for ci in demo_clients:
        existing = await db.clients.find_one({"name": ci.name})
        if existing:
            ids.append(str(existing["_id"]))
        else:
            res = await db.clients.insert_one(Client(**ci.model_dump()).to_mongo())
            ids.append(str(res.inserted_id))
    demo_projects = [
        ProjectIn(name="Flacon Éclat 50 ml", code="ML-2026-01", client_id=ids[0], type="NPD",
                  mad_date=today + timedelta(days=240), moq=50000, tech_specs="Bague FEA15, 50 ml, épaule arrondie",
                  packaging_type="croisillons"),
        ProjectIn(name="Sérum Nord — édition été", code="AN-FLK-07", client_id=ids[1], type="FLK",
                  mad_date=today + timedelta(days=150), moq=20000, glass_cycles=0, decor_cycles=2,
                  preseries_needed=False, packaging_type="ptf", ptf_lead_days=55),
        ProjectIn(name="Pot Crème 30 g — bague 58", code="AN-MLD-02", client_id=ids[1], type="MLD",
                  mad_date=today + timedelta(days=200), moq=30000, glass_cycles=1, decor_cycles=3,
                  packaging_type="barquettes"),
    ]
    created = 0
    for dp in demo_projects:
        if await db.projects.find_one({"name": dp.name}):
            continue
        plan, _, _ = await plan_for(dp)
        steps = [Step(**s) for s in plan["steps"]]
        for s in steps:  # mark past steps done except a couple to create alerts
            if date.fromisoformat(s.end) < today - timedelta(days=12):
                s.done, s.done_at = True, now_iso()
        p = Project(**{**dp.plan_input(), **plan, "steps": steps})
        await db.projects.insert_one(p.to_mongo())
        created += 1
    return {"ok": True, "created": created}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_storage():
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:  # noqa: BLE001
        logger.warning("Object storage init failed: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
