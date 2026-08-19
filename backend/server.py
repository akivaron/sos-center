from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from enum import Enum
import logging
import os
from pathlib import Path
import uuid

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
logger = logging.getLogger("resq-map")


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


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: str | None = None


class SessionExchange(BaseModel):
    session_id: str = Field(min_length=6)


class AuthResponse(BaseModel):
    session_token: str
    user: User


class IncidentCreate(BaseModel):
    incident_type: IncidentType
    severity: Severity = Severity.high
    description: str = Field(default="", max_length=280)
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


class Incident(BaseModel):
    id: str
    incident_type: IncidentType
    severity: Severity
    description: str
    longitude: float
    latitude: float
    reporter_id: str
    reporter_name: str
    created_at: str
    distance_meters: float | None = None


class SOSCreate(BaseModel):
    longitude: float
    latitude: float
    message: str = Field(default="Saya membutuhkan bantuan segera", max_length=240)
    network_state: str = Field(default="online", max_length=24)
    client_event_id: str = Field(min_length=8, max_length=80)


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
    created_at: str


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def user_from_doc(doc: dict) -> User:
    return User(
        user_id=doc["user_id"],
        email=doc["email"],
        name=doc.get("name") or doc["email"].split("@")[0],
        picture=doc.get("picture"),
    )


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
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.incidents.create_index([("location", "2dsphere")])
    await db.sos_signals.create_index([("location", "2dsphere")])
    await db.sos_signals.create_index("client_event_id", unique=True)
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


@api.get("/auth/me", response_model=User)
async def get_me(user: User = Depends(current_user)):
    return user


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
    return [Incident(**row) for row in rows]


@api.post("/incidents", response_model=Incident, status_code=201)
async def create_incident(payload: IncidentCreate, user: User = Depends(current_user)):
    incident = Incident(
        id=f"inc_{uuid.uuid4().hex[:14]}",
        incident_type=payload.incident_type,
        severity=payload.severity,
        description=payload.description,
        longitude=payload.longitude,
        latitude=payload.latitude,
        reporter_id=user.user_id,
        reporter_name=user.name,
        created_at=utc_iso(),
    )
    doc = incident.model_dump()
    doc["location"] = {
        "type": "Point",
        "coordinates": [payload.longitude, payload.latitude],
    }
    await db.incidents.insert_one(doc)
    return incident


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


@api.get("/alerts/nearby")
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
    return {"incidents": incidents, "sos_signals": signals}


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