from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from enum import Enum
import bcrypt
import logging
import os
import re
from pathlib import Path
import uuid

import httpx
import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, Field, field_validator
from starlette.responses import Response
from starlette.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
logger = logging.getLogger("resq-map")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "resq-map"
storage_key: str | None = None


def init_storage() -> str:
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_KEY:
        raise RuntimeError("Object storage key is not configured")
    response = requests.post(
        f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30
    )
    response.raise_for_status()
    storage_key = response.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    response = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    response.raise_for_status()
    return response.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    response = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    response.raise_for_status()
    return response.content, response.headers.get("Content-Type", "image/jpeg")


class IncidentType(str, Enum):
    fire = "fire"
    flood = "flood"
    earthquake = "earthquake"
    crash = "crash"
    other = "other"


class Severity(str, Enum):
    moderate = "moderate"
    high = "high"
    critical = "critical"


class LocationSource(str, Enum):
    gps = "gps"
    mesh = "mesh"


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: str | None = None
    pin_set: bool = False
    hide_gps: bool = False
    hide_mesh: bool = False


class SessionExchange(BaseModel):
    session_id: str = Field(min_length=6)


class AuthResponse(BaseModel):
    session_token: str
    user: User


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class SetPinRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=8, pattern="^[0-9]+$")


class PrivacyUpdate(BaseModel):
    hide_gps: bool | None = None
    hide_mesh: bool | None = None


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class IncidentCreate(BaseModel):
    incident_type: IncidentType
    severity: Severity = Severity.high
    description: str = Field(default="", max_length=280)
    casualty_count: int = Field(default=0, ge=0, le=10000)
    assistance_needed: str = Field(default="", max_length=280)
    photo_file_id: str | None = Field(default=None, max_length=80)
    longitude: float
    latitude: float

    @field_validator("longitude")
    @classmethod
    def valid_longitude(cls, value: float) -> float:
        if not -180 <= value <= 180:
            raise ValueError("invalid longitude")
        return value

    @field_validator("latitude")
    @classmethod
    def valid_latitude(cls, value: float) -> float:
        if not -90 <= value <= 90:
            raise ValueError("invalid latitude")
        return value


class CommunityReport(BaseModel):
    reporter_id: str
    reporter_name: str
    kind: str
    reason: str = ""
    note: str = ""
    created_at: str


class ContributorPhoto(BaseModel):
    file_id: str
    photo_url: str
    contributor_id: str
    contributor_name: str
    created_at: str


class DiscussionPost(BaseModel):
    id: str
    author_id: str
    author_name: str
    body: str
    created_at: str
    topic: str = "umum"


DISCUSSION_CHANNELS = ("umum", "koordinasi", "info", "bantuan")


class DiscussionCreate(BaseModel):
    body: str = Field(min_length=1, max_length=500)
    topic: str = "umum"

    @field_validator("topic")
    @classmethod
    def valid_topic(cls, value: str) -> str:
        if value not in DISCUSSION_CHANNELS:
            return "umum"
        return value


class ReportCreate(BaseModel):
    kind: str = Field(pattern="^(scam|real)$")
    reason: str = Field(default="", max_length=80)
    note: str = Field(default="", max_length=280)


class Notification(BaseModel):
    id: str
    user_id: str
    kind: str
    title: str
    body: str
    incident_id: str | None = None
    incident_type: str | None = None
    action: dict = {}
    read: bool = False
    created_at: str


class NotificationReadRequest(BaseModel):
    ids: list[str] | None = None
    all: bool = False


class Incident(BaseModel):
    id: str
    incident_type: IncidentType
    severity: Severity
    description: str
    casualty_count: int = 0
    assistance_needed: str = ""
    photo_file_id: str | None = None
    photo_url: str | None = None
    longitude: float
    latitude: float
    reporter_id: str
    reporter_name: str
    created_at: str
    distance_meters: float | None = None
    community_reports: list[CommunityReport] = []
    contributor_photos: list[ContributorPhoto] = []
    discussion: list[DiscussionPost] = []
    verdict: str = "unverified"
    scam_reports: int = 0
    real_reports: int = 0


class SOSCreate(BaseModel):
    longitude: float
    latitude: float
    message: str = Field(default="Saya membutuhkan bantuan segera", max_length=240)
    network_state: str = Field(default="online", max_length=24)
    client_event_id: str = Field(min_length=8, max_length=80)


class BadgeStatsPayload(BaseModel):
    relays: int = Field(default=0, ge=0, le=10_000_000)
    relay_acks: int = Field(default=0, ge=0, le=10_000_000)
    mule_transfers: int = Field(default=0, ge=0, le=1_000_000)
    anchor_seconds: int = Field(default=0, ge=0, le=100_000_000)
    gateway_upload_events: int = Field(default=0, ge=0, le=1_000_000)


class SOSSignal(BaseModel):
    id: str
    client_event_id: str
    sender_id: str
    sender_name: str
    longitude: float
    latitude: float
    message: str
    network_state: str
    status: str
    community_reports: list[CommunityReport] = []
    verdict: str = "unverified"
    scam_reports: int = 0
    real_reports: int = 0
    created_at: str


class UploadResult(BaseModel):
    file_id: str
    file_url: str
    content_type: str
    size: int


class FamilyCircleCreate(BaseModel):
    name: str | None = Field(default=None, max_length=60)


class FamilyCircleJoin(BaseModel):
    invite_code: str = Field(min_length=4, max_length=24)


class CircleLocationUpdate(BaseModel):
    longitude: float
    latitude: float
    accuracy: float | None = Field(default=None, ge=0, le=100000)
    source: LocationSource = LocationSource.gps

    @field_validator("longitude")
    @classmethod
    def valid_longitude(cls, value: float) -> float:
        if not -180 <= value <= 180:
            raise ValueError("invalid longitude")
        return value

    @field_validator("latitude")
    @classmethod
    def valid_latitude(cls, value: float) -> float:
        if not -90 <= value <= 90:
            raise ValueError("invalid latitude")
        return value


class CircleLocation(BaseModel):
    longitude: float
    latitude: float
    accuracy: float | None = None
    source: LocationSource = LocationSource.gps
    updated_at: str


class FamilyMember(BaseModel):
    user_id: str
    name: str
    role: str
    joined_at: str
    location: CircleLocation | None = None


class FamilyCircleResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    invite_code: str | None = None
    created_at: str
    members: list[FamilyMember] = []


class DonationTagKind(str, Enum):
    incident = "incident"
    area = "area"


class DonationPledgeCreate(BaseModel):
    amount: int = Field(ge=1000, le=1_000_000_000)
    message: str = Field(default="", max_length=200)


class DonationPledge(BaseModel):
    id: str
    donor_id: str
    donor_name: str
    amount: int
    message: str = ""
    created_at: str


class DonationCampaignCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=500)
    target_amount: int = Field(ge=1000, le=10_000_000_000)
    tag_kind: DonationTagKind
    incident_id: str | None = Field(default=None, max_length=80)
    area_name: str | None = Field(default=None, max_length=120)
    longitude: float | None = None
    latitude: float | None = None

    @field_validator("longitude")
    @classmethod
    def valid_longitude(cls, value: float | None) -> float | None:
        if value is not None and not -180 <= value <= 180:
            raise ValueError("invalid longitude")
        return value

    @field_validator("latitude")
    @classmethod
    def valid_latitude(cls, value: float | None) -> float | None:
        if value is not None and not -90 <= value <= 90:
            raise ValueError("invalid latitude")
        return value


class DonationPhoto(BaseModel):
    file_id: str
    photo_url: str
    uploaded_by: str
    uploaded_name: str
    created_at: str


class DonationCampaign(BaseModel):
    id: str
    title: str
    description: str
    target_amount: int
    collected_amount: int = 0
    tag_kind: DonationTagKind
    incident_id: str | None = None
    incident_type: str | None = None
    area_name: str | None = None
    longitude: float | None = None
    latitude: float | None = None
    organizer_id: str
    organizer_name: str
    pledges: list[DonationPledge] = []
    photos: list[DonationPhoto] = []
    community_reports: list[CommunityReport] = []
    verdict: str = "unverified"
    scam_reports: int = 0
    real_reports: int = 0
    created_at: str
    distance_meters: float | None = None


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def compute_verdict(reports: list[dict]) -> tuple[str, int, int]:
    scam = sum(1 for report in reports if report.get("kind") == "scam")
    real = sum(1 for report in reports if report.get("kind") == "real")
    if scam == 0 and real == 0:
        return "unverified", 0, 0
    if scam >= 3 and scam > real:
        return "likely_scam", scam, real
    if real > scam:
        return "likely_safe", scam, real
    return "suspicious", scam, real


def user_from_doc(doc: dict) -> User:
    return User(
        user_id=doc["user_id"],
        email=doc["email"],
        name=doc.get("name") or doc["email"].split("@")[0],
        picture=doc.get("picture"),
        pin_set=bool(doc.get("pin_hash")),
        hide_gps=bool(doc.get("hide_gps", False)),
        hide_mesh=bool(doc.get("hide_mesh", False)),
    )


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


_INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def make_invite_code() -> str:
    """Generate a short, human-readable, collision-resistant invite code."""
    data = uuid.uuid4().bytes
    return "".join(_INVITE_ALPHABET[byte % len(_INVITE_ALPHABET)] for byte in data[:6])


async def notify_followers(
    incident_id: str,
    incident_type: str,
    exclude_user_id: str,
    kind: str,
    title: str,
    body: str,
) -> None:
    """Create a notification for everyone following an incident except the actor."""
    incident_doc = await db.incidents.find_one(
        {"id": incident_id}, {"_id": 0, "followers": 1}
    )
    if not incident_doc:
        return
    followers = [uid for uid in (incident_doc.get("followers") or []) if uid != exclude_user_id]
    if not followers:
        return
    now = utc_iso()
    docs = [
        {
            "id": f"n_{uuid.uuid4().hex[:16]}",
            "user_id": follower_id,
            "kind": kind,
            "title": title,
            "body": body,
            "incident_id": incident_id,
            "incident_type": incident_type,
            "action": {"type": "open_incident", "incidentId": incident_id},
            "read": False,
            "created_at": now,
        }
        for follower_id in followers
    ]
    await db.notifications.insert_many(docs)


async def membership_circle_ids(user_id: str) -> list[str]:
    docs = await db.circle_members.find({"user_id": user_id}, {"_id": 0, "circle_id": 1}).to_list(200)
    return [doc["circle_id"] for doc in docs]


async def build_circle_response(circle_id: str, viewer_user_id: str) -> FamilyCircleResponse | None:
    circle = await db.family_circles.find_one({"id": circle_id}, {"_id": 0})
    if not circle:
        return None
    members = await db.circle_members.find({"circle_id": circle_id}, {"_id": 0}).to_list(200)
    loc_docs = await db.circle_locations.find({"circle_id": circle_id}, {"_id": 0, "location": 0}).to_list(200)
    loc_by_user = {doc["user_id"]: doc for doc in loc_docs}
    member_ids = [member["user_id"] for member in members]
    privacy_docs = await db.users.find(
        {"user_id": {"$in": member_ids}}, {"_id": 0, "user_id": 1, "hide_gps": 1, "hide_mesh": 1}
    ).to_list(200)
    hidden = {
        doc["user_id"]: (bool(doc.get("hide_gps", False)), bool(doc.get("hide_mesh", False)))
        for doc in privacy_docs
    }
    member_list: list[FamilyMember] = []
    for member in members:
        loc = loc_by_user.get(member["user_id"])
        # When viewing someone else's location, respect their visibility choices.
        if loc and member["user_id"] != viewer_user_id:
            hide_gps, hide_mesh = hidden.get(member["user_id"], (False, False))
            source = loc.get("source", "gps")
            if (source == "gps" and hide_gps) or (source == "mesh" and hide_mesh):
                loc = None
        member_list.append(FamilyMember(
            user_id=member["user_id"],
            name=member["user_name"],
            role=member["role"],
            joined_at=member["joined_at"],
            location=CircleLocation(
                longitude=loc["longitude"],
                latitude=loc["latitude"],
                accuracy=loc.get("accuracy"),
                source=LocationSource(loc.get("source", "gps")),
                updated_at=loc["updated_at"],
            ) if loc else None,
        ))
    is_owner = circle["owner_id"] == viewer_user_id
    return FamilyCircleResponse(
        id=circle["id"],
        name=circle["name"],
        owner_id=circle["owner_id"],
        invite_code=circle["invite_code"] if is_owner else None,
        created_at=circle["created_at"],
        members=member_list,
    )


async def create_session(user_id: str) -> str:
    session_token = f"tok_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at,
        }},
        upsert=True,
    )
    return session_token


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def incident_from_doc(doc: dict) -> Incident:
    clean = {key: value for key, value in doc.items() if key not in {"_id", "location", "followers"}}
    file_id = clean.get("photo_file_id")
    clean["photo_url"] = f"/api/incident-media/{file_id}" if file_id else None
    return Incident(**clean)


async def current_user(authorization: str | None = Header(default=None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.removeprefix("Bearer ").strip()
    session = await db.user_sessions.find_one(
        {"session_token": token}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one(
        {"user_id": session["user_id"]}, {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user_from_doc(user)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        from migrations import run_migrations

        await run_migrations(db)
    except Exception as exc:
        logger.warning("Migrations unavailable (%s); applying core indexes directly.", exc)
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.incidents.create_index([("location", "2dsphere")])
        await db.sos_signals.create_index([("location", "2dsphere")])
        await db.sos_signals.create_index("client_event_id", unique=True)
        await db.family_circles.create_index("id", unique=True)
        await db.family_circles.create_index("invite_code", unique=True)
        await db.circle_members.create_index([("circle_id", 1), ("user_id", 1)], unique=True)
        await db.circle_locations.create_index([("circle_id", 1), ("user_id", 1)], unique=True)
        await db.circle_locations.create_index([("location", "2dsphere")])
        await db.donation_campaigns.create_index("id", unique=True)
        await db.donation_campaigns.create_index([("location", "2dsphere")])
    try:
        await run_in_threadpool(init_storage)
    except Exception as exc:
        logger.warning("Object storage initialization deferred: %s", exc)
    yield
    client.close()


app = FastAPI(title="ResQ Map API", version="1.0.0", lifespan=lifespan)
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"service": "ResQ Map", "status": "ready"}


@api.post("/auth/session", response_model=AuthResponse)
async def exchange_session(payload: SessionExchange):
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            response = await http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": payload.session_id},
            )
    except httpx.HTTPError as exc:
        logger.warning("Auth provider unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Authentication unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    data = response.json()
    email = data.get("email")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Incomplete session data")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    user_id = existing["user_id"] if existing else f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": data.get("name") or email.split("@")[0],
        "picture": data.get("picture"),
        "updated_at": utc_iso(),
    }
    await db.users.update_one({"email": email}, {"$set": user_doc}, upsert=True)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at,
        }},
        upsert=True,
    )
    return AuthResponse(session_token=session_token, user=user_from_doc(user_doc))


@api.post("/auth/register", response_model=AuthResponse)
async def register(payload: RegisterRequest):
    email = payload.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": (payload.name or "").strip() or email.split("@")[0],
        "picture": None,
        "password_hash": hash_password(payload.password),
        "auth_method": "password",
        "created_at": utc_iso(),
        "updated_at": utc_iso(),
    }
    await db.users.insert_one(user_doc)
    token = await create_session(user_id)
    return AuthResponse(session_token=token, user=user_from_doc(user_doc))


@api.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = await create_session(user["user_id"])
    return AuthResponse(session_token=token, user=user_from_doc(user))


@api.get("/auth/me", response_model=User)
async def get_me(user: User = Depends(current_user)):
    return user


async def _require_password_user(user: User) -> dict:
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not doc or not doc.get("password_hash"):
        raise HTTPException(status_code=403, detail="Password sign-in is required for this action")
    return doc


@api.post("/auth/change-password")
async def change_password(payload: ChangePasswordRequest, user: User = Depends(current_user)):
    doc = await _require_password_user(user)
    if not verify_password(payload.current_password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": utc_iso()}},
    )
    return {"ok": True}


@api.post("/auth/pin")
async def set_pin(payload: SetPinRequest, user: User = Depends(current_user)):
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"pin_hash": hash_password(payload.pin), "updated_at": utc_iso()}},
    )
    return {"ok": True, "pin_set": True}


@api.get("/auth/privacy")
async def get_privacy(user: User = Depends(current_user)):
    return {"hide_gps": user.hide_gps, "hide_mesh": user.hide_mesh}


@api.patch("/auth/privacy")
async def update_privacy(payload: PrivacyUpdate, user: User = Depends(current_user)):
    update: dict = {"updated_at": utc_iso()}
    if payload.hide_gps is not None:
        update["hide_gps"] = payload.hide_gps
    if payload.hide_mesh is not None:
        update["hide_mesh"] = payload.hide_mesh
    if not update:
        return {"ok": True, "hide_gps": user.hide_gps, "hide_mesh": user.hide_mesh}
    await db.users.update_one({"user_id": user.user_id}, {"$set": update})
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return {"ok": True, "hide_gps": bool(doc.get("hide_gps", False)), "hide_mesh": bool(doc.get("hide_mesh", False))}


BADGE_FIELDS = ("relays", "relay_acks", "mule_transfers", "anchor_seconds", "gateway_upload_events")


def badges_from_doc(doc: dict) -> dict:
    return {field: int(doc.get("badge_" + field, 0) or 0) for field in BADGE_FIELDS}


@api.post("/badges/sync")
async def sync_badges(payload: BadgeStatsPayload, user: User = Depends(current_user)):
    # Monotonic merge: offline counters can only grow, so never let a stale
    # device overwrite higher values already recorded from another sync.
    incoming = payload.model_dump()
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    update = {
        "badge_" + field: max(int(doc.get("badge_" + field, 0) or 0), incoming[field])
        for field in BADGE_FIELDS
    }
    update["updated_at"] = utc_iso()
    await db.users.update_one({"user_id": user.user_id}, {"$set": update})
    return {"ok": True, "badges": badges_from_doc({**doc, **update})}


@api.get("/badges")
async def get_badges(user: User = Depends(current_user)):
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    return badges_from_doc(doc)


@api.delete("/auth/account")
async def delete_account(payload: DeleteAccountRequest, user: User = Depends(current_user)):
    doc = await _require_password_user(user)
    if not verify_password(payload.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Password is incorrect")
    await db.user_sessions.delete_many({"user_id": user.user_id})
    await db.circle_members.delete_many({"user_id": user.user_id})
    await db.circle_locations.delete_many({"user_id": user.user_id})
    await db.incidents.delete_many({"reporter_id": user.user_id})
    await db.sos_signals.delete_many({"sender_id": user.user_id})
    await db.users.delete_one({"user_id": user.user_id})
    return {"ok": True}


@api.post("/uploads/incident-photo", response_model=UploadResult, status_code=201)
async def upload_incident_photo(
    file: UploadFile = File(...), user: User = Depends(current_user)
):
    file_id, path, content_type, size = await store_image_file(file, user)
    file_doc = {
        "file_id": file_id,
        "owner_id": user.user_id,
        "storage_path": path,
        "original_name": file.filename or f"incident.{content_type.split('/')[-1]}",
        "content_type": content_type,
        "size": size,
        "created_at": utc_iso(),
        "attached_to": None,
    }
    await db.media_files.insert_one(file_doc)
    return UploadResult(
        file_id=file_id,
        file_url=f"/api/files/{file_id}",
        content_type=content_type,
        size=size,
    )


_ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}
_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024


async def store_image_file(file: UploadFile, user: User) -> tuple[str, str, str, int]:
    """Validate and persist an uploaded image, returning its (file_id, storage_path, content_type, size)."""
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported image format")
    data = await file.read(_UPLOAD_LIMIT_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Empty image")
    if len(data) > _UPLOAD_LIMIT_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 5 MB")
    file_id = f"file_{uuid.uuid4().hex[:16]}"
    path = f"{APP_NAME}/uploads/{user.user_id}/{uuid.uuid4().hex}.{_ALLOWED_IMAGE_TYPES[content_type]}"
    try:
        result = await run_in_threadpool(put_object, path, data, content_type)
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 503
        if status == 402:
            raise HTTPException(status_code=402, detail="Photo storage unavailable") from exc
        raise HTTPException(status_code=503, detail="Photo upload unavailable") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Photo upload unavailable") from exc
    return file_id, result.get("path", path), content_type, len(data)


@api.get("/files/{file_id}")
async def download_file(file_id: str, user: User = Depends(current_user)):
    file_doc = await db.media_files.find_one(
        {"file_id": file_id, "owner_id": user.user_id}, {"_id": 0}
    )
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content, content_type = await run_in_threadpool(
            get_object, file_doc["storage_path"]
        )
    except requests.HTTPError as exc:
        raise HTTPException(status_code=503, detail="File unavailable") from exc
    return Response(content=content, media_type=content_type)


@api.get("/incident-media/{file_id}")
async def public_incident_media(file_id: str):
    file_doc = await db.media_files.find_one(
        {"file_id": file_id, "attached_to": {"$ne": None}}, {"_id": 0}
    )
    if not file_doc:
        raise HTTPException(status_code=404, detail="Incident media not found")
    incident = await db.incidents.find_one(
        {
            "id": file_doc["attached_to"],
            "$or": [
                {"photo_file_id": file_id},
                {"contributor_photos.file_id": file_id},
            ],
        },
        {"_id": 0, "id": 1},
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident media not found")
    try:
        content, content_type = await run_in_threadpool(
            get_object, file_doc["storage_path"]
        )
    except requests.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Incident media unavailable") from exc
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=300",
            "CDN-Cache-Control": "public, max-age=300",
            "Surrogate-Control": "max-age=300",
        },
    )


@api.get("/incidents", response_model=list[Incident])
async def list_incidents(
    longitude: float | None = Query(default=None, ge=-180, le=180),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    radius_meters: int = Query(default=50000, ge=500, le=500000),
):
    query: dict = {}
    if longitude is not None and latitude is not None:
        query["location"] = {
            "$near": {
                "$geometry": {"type": "Point", "coordinates": [longitude, latitude]},
                "$maxDistance": radius_meters,
            }
        }
    rows = await db.incidents.find(query, {"_id": 0}).limit(250).to_list(250)
    return [incident_from_doc(row) for row in rows]


@api.post("/incidents", response_model=Incident, status_code=201)
async def create_incident(payload: IncidentCreate, user: User = Depends(current_user)):
    if payload.photo_file_id:
        owned_file = await db.media_files.find_one(
            {"file_id": payload.photo_file_id, "owner_id": user.user_id}, {"_id": 0}
        )
        if not owned_file:
            raise HTTPException(status_code=400, detail="Incident photo not found")
    incident = Incident(
        id=f"inc_{uuid.uuid4().hex[:14]}",
        incident_type=payload.incident_type,
        severity=payload.severity,
        description=payload.description,
        casualty_count=payload.casualty_count,
        assistance_needed=payload.assistance_needed,
        photo_file_id=payload.photo_file_id,
        photo_url=(
            f"/api/incident-media/{payload.photo_file_id}"
            if payload.photo_file_id else None
        ),
        longitude=payload.longitude,
        latitude=payload.latitude,
        reporter_id=user.user_id,
        reporter_name=user.name,
        created_at=utc_iso(),
    )
    doc = incident.model_dump(exclude={"photo_url"})
    doc["location"] = {
        "type": "Point",
        "coordinates": [payload.longitude, payload.latitude],
    }
    await db.incidents.insert_one(doc)
    if payload.photo_file_id:
        await db.media_files.update_one(
            {"file_id": payload.photo_file_id},
            {"$set": {"attached_to": incident.id}},
        )
    return incident


@api.post("/incidents/{incident_id}/photos", response_model=Incident, status_code=200)
async def add_contributor_photo(
    incident_id: str, file: UploadFile = File(...), user: User = Depends(current_user)
):
    """Let any signed-in user add a supporting photo to an incident (like Google Places)."""
    incident_doc = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
    if not incident_doc:
        raise HTTPException(status_code=404, detail="Incident not found")
    file_id, path, content_type, size = await store_image_file(file, user)
    await db.media_files.insert_one({
        "file_id": file_id,
        "owner_id": user.user_id,
        "storage_path": path,
        "original_name": file.filename or f"incident.{content_type.split('/')[-1]}",
        "content_type": content_type,
        "size": size,
        "created_at": utc_iso(),
        "attached_to": incident_id,
    })
    photo = ContributorPhoto(
        file_id=file_id,
        photo_url=f"/api/incident-media/{file_id}",
        contributor_id=user.user_id,
        contributor_name=user.name,
        created_at=utc_iso(),
    )
    await db.incidents.update_one(
        {"id": incident_id}, {"$push": {"contributor_photos": photo.model_dump()}}
    )
    incident_doc.setdefault("contributor_photos", []).append(photo.model_dump())
    await notify_followers(
        incident_id=incident_id,
        incident_type=incident_doc.get("incident_type", "other"),
        exclude_user_id=user.user_id,
        kind="incident_update",
        title="Pembaruan insiden",
        body=f"{user.name} menambahkan foto ke insiden ini.",
    )
    return incident_from_doc(incident_doc)


@api.post("/incidents/{incident_id}/discussion", response_model=Incident, status_code=200)
async def post_discussion(
    incident_id: str, payload: DiscussionCreate, user: User = Depends(current_user)
):
    """Append a message to the incident's public discussion thread."""
    incident_doc = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
    if not incident_doc:
        raise HTTPException(status_code=404, detail="Incident not found")
    post = DiscussionPost(
        id=f"d_{uuid.uuid4().hex[:12]}",
        author_id=user.user_id,
        author_name=user.name,
        body=payload.body,
        created_at=utc_iso(),
        topic=payload.topic,
    )
    await db.incidents.update_one(
        {"id": incident_id}, {"$push": {"discussion": post.model_dump()}}
    )
    incident_doc.setdefault("discussion", []).append(post.model_dump())
    await notify_followers(
        incident_id=incident_id,
        incident_type=incident_doc.get("incident_type", "other"),
        exclude_user_id=user.user_id,
        kind="discussion",
        title="Diskusi insiden",
        body=f"{user.name}: {payload.body}",
    )
    return incident_from_doc(incident_doc)


@api.post("/sos", response_model=SOSSignal, status_code=201)
async def create_sos(payload: SOSCreate, user: User = Depends(current_user)):
    existing = await db.sos_signals.find_one(
        {"client_event_id": payload.client_event_id}, {"_id": 0, "location": 0}
    )
    if existing:
        return SOSSignal(**existing)
    signal = SOSSignal(
        id=f"sos_{uuid.uuid4().hex[:14]}",
        client_event_id=payload.client_event_id,
        sender_id=user.user_id,
        sender_name=user.name,
        longitude=payload.longitude,
        latitude=payload.latitude,
        message=payload.message,
        network_state=payload.network_state,
        status="broadcast",
        created_at=utc_iso(),
    )
    doc = signal.model_dump()
    doc["location"] = {
        "type": "Point",
        "coordinates": [payload.longitude, payload.latitude],
    }
    await db.sos_signals.insert_one(doc)
    return signal


async def _attach_verdict(docs: list[dict]) -> list[dict]:
    for doc in docs:
        reports = doc.get("community_reports", []) or []
        verdict, scam, real = compute_verdict(reports)
        doc["verdict"] = verdict
        doc["scam_reports"] = scam
        doc["real_reports"] = real
    return docs


@app.post("/api/incidents/{incident_id}/reports", response_model=Incident, status_code=200)
async def report_incident(incident_id: str, payload: ReportCreate, user: User = Depends(current_user)):
    doc = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Incident not found")
    reports = [report for report in (doc.get("community_reports") or []) if report.get("reporter_id") != user.user_id]
    reports.append({
        "reporter_id": user.user_id,
        "reporter_name": user.name,
        "kind": payload.kind,
        "reason": payload.reason or "",
        "note": payload.note or "",
        "created_at": utc_iso(),
    })
    verdict, scam, real = compute_verdict(reports)
    previous_verdict = doc.get("verdict", "unverified")
    await db.incidents.update_one(
        {"id": incident_id},
        {"$set": {"community_reports": reports, "verdict": verdict, "scam_reports": scam, "real_reports": real}},
    )
    doc.update(community_reports=reports, verdict=verdict, scam_reports=scam, real_reports=real)
    if verdict != previous_verdict:
        await notify_followers(
            incident_id=incident_id,
            incident_type=doc.get("incident_type", "other"),
            exclude_user_id=user.user_id,
            kind="verdict",
            title="Status verifikasi insiden",
            body=f"Insiden kini berstatus: {verdict}.",
        )
    return incident_from_doc(doc)


@app.post("/api/incidents/{incident_id}/follow", status_code=200)
async def follow_incident(incident_id: str, user: User = Depends(current_user)):
    incident_doc = await db.incidents.find_one({"id": incident_id}, {"_id": 0, "followers": 1})
    if incident_doc is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    await db.incidents.update_one(
        {"id": incident_id}, {"$addToSet": {"followers": user.user_id}}
    )
    followers = (incident_doc.get("followers") or [])
    if user.user_id not in followers:
        followers = [*followers, user.user_id]
    return {"following": True, "follower_count": len(followers)}


@app.delete("/api/incidents/{incident_id}/follow", status_code=200)
async def unfollow_incident(incident_id: str, user: User = Depends(current_user)):
    incident_doc = await db.incidents.find_one({"id": incident_id}, {"_id": 0, "followers": 1})
    if incident_doc is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    await db.incidents.update_one(
        {"id": incident_id}, {"$pull": {"followers": user.user_id}}
    )
    followers = [uid for uid in (incident_doc.get("followers") or []) if uid != user.user_id]
    return {"following": False, "follower_count": len(followers)}


@app.get("/api/incidents/{incident_id}/follow", status_code=200)
async def incident_follow_status(incident_id: str, user: User = Depends(current_user)):
    incident_doc = await db.incidents.find_one({"id": incident_id}, {"_id": 0, "followers": 1})
    if incident_doc is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    followers = incident_doc.get("followers") or []
    return {"following": user.user_id in followers, "follower_count": len(followers)}


@app.get("/api/notifications", response_model=list[Notification])
async def list_notifications(user: User = Depends(current_user)):
    rows = await db.notifications.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    return [Notification(**row) for row in rows]


@app.post("/api/notifications/read", status_code=200)
async def mark_notifications_read(payload: NotificationReadRequest, user: User = Depends(current_user)):
    query: dict = {"user_id": user.user_id}
    if not payload.all and payload.ids:
        query["id"] = {"$in": payload.ids}
    elif payload.all:
        pass
    else:
        return {"ok": True, "updated": 0}
    result = await db.notifications.update_many(query, {"$set": {"read": True}})
    return {"ok": True, "updated": result.modified_count}


@app.post("/api/sos/{sos_id}/reports", response_model=SOSSignal, status_code=200)
async def report_sos(sos_id: str, payload: ReportCreate, user: User = Depends(current_user)):
    doc = await db.sos_signals.find_one({"id": sos_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="SOS signal not found")
    reports = [report for report in (doc.get("community_reports") or []) if report.get("reporter_id") != user.user_id]
    reports.append({
        "reporter_id": user.user_id,
        "reporter_name": user.name,
        "kind": payload.kind,
        "reason": payload.reason or "",
        "note": payload.note or "",
        "created_at": utc_iso(),
    })
    verdict, scam, real = compute_verdict(reports)
    await db.sos_signals.update_one(
        {"id": sos_id},
        {"$set": {"community_reports": reports, "verdict": verdict, "scam_reports": scam, "real_reports": real}},
    )
    doc.update(community_reports=reports, verdict=verdict, scam_reports=scam, real_reports=real)
    return SOSSignal(**{key: value for key, value in doc.items() if key != "location"})


@app.get("/alerts/nearby")
async def nearby_alerts(
    longitude: float = Query(ge=-180, le=180),
    latitude: float = Query(ge=-90, le=90),
    radius_meters: int = Query(default=10000, ge=500, le=100000),
):
    geo = {
        "$near": {
            "$geometry": {"type": "Point", "coordinates": [longitude, latitude]},
            "$maxDistance": radius_meters,
        }
    }
    incidents = await db.incidents.find(
        {"location": geo}, {"_id": 0, "location": 0}
    ).limit(20).to_list(20)
    signals = await db.sos_signals.find(
        {"location": geo}, {"_id": 0, "location": 0}
    ).limit(20).to_list(20)
    return {"incidents": _attach_verdict(incidents), "sos_signals": _attach_verdict(signals)}


# ---------------------------------------------------------------------------
# Family Circle: private groups that share live location over GPS and mesh.
# ---------------------------------------------------------------------------

@api.post("/family-circles", response_model=FamilyCircleResponse, status_code=201)
async def create_family_circle(payload: FamilyCircleCreate, user: User = Depends(current_user)):
    circle_id = f"fc_{uuid.uuid4().hex[:12]}"
    now = utc_iso()
    member_doc = {
        "circle_id": circle_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "role": "owner",
        "joined_at": now,
    }
    for _ in range(5):
        circle_doc = {
            "id": circle_id,
            "owner_id": user.user_id,
            "name": (payload.name or "").strip() or f"Lingkaran {user.name}",
            "invite_code": make_invite_code(),
            "created_at": now,
        }
        try:
            await db.family_circles.insert_one(circle_doc)
            break
        except DuplicateKeyError:
            continue
    else:
        raise HTTPException(status_code=500, detail="Failed to allocate invite code")
    await db.circle_members.insert_one(member_doc)
    result = await build_circle_response(circle_id, user.user_id)
    if result is None:
        raise HTTPException(status_code=500, detail="Failed to create family circle")
    return result


@api.post("/family-circles/join", response_model=FamilyCircleResponse, status_code=201)
async def join_family_circle(payload: FamilyCircleJoin, user: User = Depends(current_user)):
    code = payload.invite_code.strip().upper()
    circle = await db.family_circles.find_one({"invite_code": code}, {"_id": 0})
    if not circle:
        raise HTTPException(status_code=404, detail="Invite code not found")
    existing = await db.circle_members.find_one(
        {"circle_id": circle["id"], "user_id": user.user_id}, {"_id": 0}
    )
    if not existing:
        await db.circle_members.insert_one({
            "circle_id": circle["id"],
            "user_id": user.user_id,
            "user_name": user.name,
            "role": "member",
            "joined_at": utc_iso(),
        })
    result = await build_circle_response(circle["id"], user.user_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Family circle not found")
    return result


@api.get("/family-circles", response_model=list[FamilyCircleResponse])
async def list_family_circles(user: User = Depends(current_user)):
    circle_ids = await membership_circle_ids(user.user_id)
    circles = []
    for circle_id in circle_ids:
        response = await build_circle_response(circle_id, user.user_id)
        if response:
            circles.append(response)
    return circles


@api.post("/family-circles/location", status_code=200)
async def share_circle_location(payload: CircleLocationUpdate, user: User = Depends(current_user)):
    circle_ids = await membership_circle_ids(user.user_id)
    if not circle_ids:
        return {"circles": []}
    now = utc_iso()
    updated: list[str] = []
    for circle_id in circle_ids:
        await db.circle_locations.update_one(
            {"circle_id": circle_id, "user_id": user.user_id},
            {"$set": {
                "circle_id": circle_id,
                "user_id": user.user_id,
                "longitude": payload.longitude,
                "latitude": payload.latitude,
                "accuracy": payload.accuracy,
                "source": payload.source.value,
                "updated_at": now,
                "location": {
                    "type": "Point",
                    "coordinates": [payload.longitude, payload.latitude],
                },
            }},
            upsert=True,
        )
        updated.append(circle_id)
    return {"circles": updated}


@api.delete("/family-circles/{circle_id}/members/{target_user_id}", status_code=200)
async def remove_circle_member(circle_id: str, target_user_id: str, user: User = Depends(current_user)):
    circle = await db.family_circles.find_one({"id": circle_id}, {"_id": 0})
    if not circle:
        raise HTTPException(status_code=404, detail="Family circle not found")
    membership = await db.circle_members.find_one(
        {"circle_id": circle_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this circle")
    is_owner = circle["owner_id"] == user.user_id
    leaving_self = target_user_id == user.user_id
    if not is_owner and not leaving_self:
        raise HTTPException(status_code=403, detail="Only the owner can remove other members")
    if not leaving_self and target_user_id == circle["owner_id"]:
        raise HTTPException(status_code=400, detail="Owner cannot be removed by another member")

    await db.circle_members.delete_one({"circle_id": circle_id, "user_id": target_user_id})
    await db.circle_locations.delete_many({"circle_id": circle_id, "user_id": target_user_id})

    remaining = await db.circle_members.find({"circle_id": circle_id}, {"_id": 0}).to_list(200)
    if not remaining:
        await db.family_circles.delete_one({"id": circle_id})
        await db.circle_locations.delete_many({"circle_id": circle_id})
        return {"ok": True, "deleted": True}

    if leaving_self and is_owner:
        # Promote the earliest remaining member to owner so the circle survives.
        new_owner = min(remaining, key=lambda member: member["joined_at"])
        await db.circle_members.update_one(
            {"circle_id": circle_id, "user_id": new_owner["user_id"]},
            {"$set": {"role": "owner"}},
        )
        await db.family_circles.update_one(
            {"id": circle_id}, {"$set": {"owner_id": new_owner["user_id"]}}
        )
    return {"ok": True, "deleted": False}


# ---------------------------------------------------------------------------
# Donation campaigns: fundraisers tagged to an incident or a geographic area.
# ---------------------------------------------------------------------------

@api.post("/donations", response_model=DonationCampaign, status_code=201)
async def create_donation_campaign(payload: DonationCampaignCreate, user: User = Depends(current_user)):
    if payload.tag_kind == DonationTagKind.incident:
        if not payload.incident_id:
            raise HTTPException(status_code=400, detail="incident_id is required for incident-tagged campaigns")
        incident = await db.incidents.find_one(
            {"id": payload.incident_id}, {"_id": 0, "id": 1, "incident_type": 1, "longitude": 1, "latitude": 1}
        )
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
    else:
        if payload.longitude is None or payload.latitude is None:
            raise HTTPException(status_code=400, detail="Coordinates are required for area-tagged campaigns")
        incident = None

    campaign = DonationCampaign(
        id=f"don_{uuid.uuid4().hex[:14]}",
        title=payload.title.strip(),
        description=payload.description.strip(),
        target_amount=payload.target_amount,
        tag_kind=payload.tag_kind,
        incident_id=payload.incident_id,
        incident_type=(incident or {}).get("incident_type"),
        area_name=(payload.area_name or "").strip() or None,
        longitude=payload.longitude if incident is None else incident.get("longitude"),
        latitude=payload.latitude if incident is None else incident.get("latitude"),
        organizer_id=user.user_id,
        organizer_name=user.name,
        created_at=utc_iso(),
    )
    doc = campaign.model_dump()
    doc["location"] = {
        "type": "Point",
        "coordinates": [campaign.longitude, campaign.latitude],
    }
    await db.donation_campaigns.insert_one(doc)
    return campaign


@api.get("/donations", response_model=list[DonationCampaign])
async def list_donation_campaigns(
    longitude: float | None = Query(default=None, ge=-180, le=180),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    radius_meters: int = Query(default=50000, ge=500, le=500000),
):
    query: dict = {}
    projection = {"_id": 0, "location": 0}
    if longitude is not None and latitude is not None:
        try:
            rows = await db.donation_campaigns.find(
                {
                    "location": {
                        "$near": {
                            "$geometry": {"type": "Point", "coordinates": [longitude, latitude]},
                            "$maxDistance": radius_meters,
                        }
                    }
                },
                projection,
            ).limit(200).to_list(200)
        except Exception:
            rows = []
        if not rows:
            all_rows = await db.donation_campaigns.find({}, projection).sort("created_at", -1).limit(200).to_list(200)
            rows = [
                row for row in all_rows
                if row.get("longitude") is not None and row.get("latitude") is not None
                and haversine_deg(longitude, latitude, row["longitude"], row["latitude"]) <= radius_meters
            ]
    else:
        rows = await db.donation_campaigns.find({}, projection).sort("created_at", -1).limit(200).to_list(200)
    return [DonationCampaign(**row) for row in rows]


def haversine_deg(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    from math import asin, cos, radians, sin, sqrt
    lon1, lat1, lon2, lat2 = map(radians, (lon1, lat1, lon2, lat2))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371000 * 2 * asin(sqrt(a))


@api.post("/donations/{campaign_id}/pledges", response_model=DonationCampaign, status_code=200)
async def pledge_donation(campaign_id: str, payload: DonationPledgeCreate, user: User = Depends(current_user)):
    doc = await db.donation_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    pledge = DonationPledge(
        id=f"pl_{uuid.uuid4().hex[:12]}",
        donor_id=user.user_id,
        donor_name=user.name,
        amount=payload.amount,
        message=payload.message.strip(),
        created_at=utc_iso(),
    )
    updated = await db.donation_campaigns.find_one_and_update(
        {"id": campaign_id},
        {
            "$push": {"pledges": pledge.model_dump()},
            "$inc": {"collected_amount": payload.amount},
        },
        return_document=True,
    )
    result = DonationCampaign(**{key: value for key, value in updated.items() if key != "location"})
    if result.tag_kind == DonationTagKind.incident and result.incident_id:
        await notify_followers(
            incident_id=result.incident_id,
            incident_type=result.incident_type or "other",
            exclude_user_id=user.user_id,
            kind="donation",
            title="Galang donasi",
            body=f"{user.name} berdonasi ke \"{result.title}\".",
        )
    return result


@api.post("/donations/{campaign_id}/photos", response_model=DonationCampaign, status_code=200)
async def add_donation_photo(
    campaign_id: str, file: UploadFile = File(...), user: User = Depends(current_user)
):
    """Attach a supporting photo to a donation campaign (max 4 per campaign)."""
    doc = await db.donation_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if len(doc.get("photos") or []) >= 4:
        raise HTTPException(status_code=400, detail="Campaign photo limit reached")
    file_id, path, content_type, size = await store_image_file(file, user)
    await db.media_files.insert_one({
        "file_id": file_id,
        "owner_id": user.user_id,
        "storage_path": path,
        "original_name": file.filename or f"donation.{content_type.split('/')[-1]}",
        "content_type": content_type,
        "size": size,
        "created_at": utc_iso(),
        "attached_to": campaign_id,
    })
    photo = DonationPhoto(
        file_id=file_id,
        photo_url=f"/api/donation-media/{file_id}",
        uploaded_by=user.user_id,
        uploaded_name=user.name,
        created_at=utc_iso(),
    )
    updated = await db.donation_campaigns.find_one_and_update(
        {"id": campaign_id},
        {"$push": {"photos": photo.model_dump()}},
        return_document=True,
    )
    return DonationCampaign(**{key: value for key, value in updated.items() if key != "location"})


@api.get("/donation-media/{file_id}")
async def public_donation_media(file_id: str):
    file_doc = await db.media_files.find_one(
        {"file_id": file_id, "attached_to": {"$ne": None}}, {"_id": 0}
    )
    if not file_doc:
        raise HTTPException(status_code=404, detail="Donation media not found")
    campaign = await db.donation_campaigns.find_one(
        {"id": file_doc["attached_to"], "photos.file_id": file_id}, {"_id": 0, "id": 1}
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Donation media not found")
    try:
        content, content_type = await run_in_threadpool(get_object, file_doc["storage_path"])
    except requests.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Donation media unavailable") from exc
    return Response(
        content=content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=300"},
    )


@api.post("/donations/{campaign_id}/reports", response_model=DonationCampaign, status_code=200)
async def report_donation_campaign(campaign_id: str, payload: ReportCreate, user: User = Depends(current_user)):
    """Community verification for a fundraiser (scam / real), same rules as incidents."""
    doc = await db.donation_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    reports = [report for report in (doc.get("community_reports") or []) if report.get("reporter_id") != user.user_id]
    reports.append({
        "reporter_id": user.user_id,
        "reporter_name": user.name,
        "kind": payload.kind,
        "reason": payload.reason or "",
        "note": payload.note or "",
        "created_at": utc_iso(),
    })
    verdict, scam, real = compute_verdict(reports)
    await db.donation_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"community_reports": reports, "verdict": verdict, "scam_reports": scam, "real_reports": real}},
    )
    doc.update(community_reports=reports, verdict=verdict, scam_reports=scam, real_reports=real)
    return DonationCampaign(**{key: value for key, value in doc.items() if key != "location"})


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)