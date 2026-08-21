"""
Seed acak insiden ke koleksi `incidents` (MongoDB).
Menyisipkan data dengan struktur sama persis seperti yang dibuat endpoint
POST /incidents agar langsung tampil di peta & layar navigasi.

Usage:
    python seed_incidents.py            # seed 30 insiden acak (bersihkan seed sebelumnya)
    python seed_incidents.py --count 50
    python seed_incidents.py --clear-only
"""
import argparse
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT, ".env"))

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "resq_map")

INCIDENT_TYPES = ["fire", "flood", "earthquake", "crash", "other"]
SEVERITIES = ["moderate", "high", "critical"]

HUBS = {
    "Jakarta": (-6.2088, 106.8456),
    "Bandung": (-6.9175, 107.6191),
    "Surabaya": (-7.2575, 112.7521),
    "Yogyakarta": (-7.7971, 110.3700),
    "Medan": (3.5952, 98.6722),
    "Denpasar": (-8.6705, 115.2126),
    "Semarang": (-6.9667, 110.4167),
    "Makassar": (-5.1477, 119.4327),
    "Ajibarang": (-7.3867, 109.1833),
}

REPORTERS = [
    ("usr_a1b2c3d4e5", "Budi Santoso"),
    ("usr_f6g7h8i9j0", "Siti Rahayu"),
    ("usr_k1l2m3n4o5", "Ahmad Fauzi"),
    ("usr_p6q7r8s9t0", "Dewi Lestari"),
    ("usr_u1v2w3x4y5", "Eko Prasetyo"),
]

DESCRIPTIONS = {
    "fire": [
        "Kebakaran lapak pedagang di pinggir jalan, kepulan asap terlihat dari jauh.",
        "Api merembet ke rumah warga setelah konsleting listrik.",
        "Kebakaran lahan kosong dekat permukiman padat.",
    ],
    "flood": [
        "Genangan setinggi lutut menutup akses jalan utama.",
        "Banjir kiriman dari hulu, kendaraan tidak bisa lewat.",
        "Air masuk ke teras rumah warga saat hujan deras.",
    ],
    "earthquake": [
        "Goncangan terasa kuat selama beberapa detik, warga keluar rumah.",
        "Getaran membuat retakan pada dinding bangunan.",
        "Gempa susulan terasa setelah gempa utama pagi tadi.",
    ],
    "crash": [
        "Tabrakan dua sepeda motor di perempatan lampu merah.",
        "Mobil terbalik menabrak pembatas jalan tol.",
        "Kecelakaan bus kecil menabrak tiang listrik.",
    ],
    "other": [
        "Pohon tumbang menutup separuh badan jalan.",
        "Jembatan kayu rusak, warga khawatir melintas.",
        "Tanah longsor kecil di tebing dekat pemukiman.",
    ],
}

ASSISTANCE = {
    "fire": ["Pemadam kebakaran", "Ambulans", "Evakuasi warga"],
    "flood": ["Perahu karet", "Ambulans", "Makanan siap saji"],
    "earthquake": ["Tim SAR", "Ambulans", "Tenda darurat"],
    "crash": ["Ambulans", "Polisi lalu lintas", "Derek"],
    "other": ["Alat berat", "Tim pemadam", "Bantuan logistik"],
}


def random_point(hub=None):
    if hub:
        lat0, lon0 = HUBS[hub]
    else:
        lat0, lon0 = random.choice(list(HUBS.values()))
    return lat0 + random.uniform(-0.05, 0.05), lon0 + random.uniform(-0.05, 0.05)


def make_incident(hub=None):
    incident_type = random.choice(INCIDENT_TYPES)
    severity = random.choices(SEVERITIES, weights=[4, 4, 2])[0]
    lat, lon = random_point(hub)
    reporter_id, reporter_name = random.choice(REPORTERS)
    needs = random.sample(ASSISTANCE[incident_type], k=random.randint(1, 3))
    age_minutes = random.randint(2, 60 * 72)
    created = datetime.now(timezone.utc) - timedelta(minutes=age_minutes)
    return {
        "id": f"inc_{uuid.uuid4().hex[:14]}",
        "incident_type": incident_type,
        "severity": severity,
        "description": random.choice(DESCRIPTIONS[incident_type]),
        "casualty_count": random.choices([0, 0, 1, 2, 3, 5], weights=[5, 3, 4, 3, 2, 1])[0],
        "assistance_needed": ", ".join(needs),
        "photo_file_id": None,
        "longitude": lon,
        "latitude": lat,
        "reporter_id": reporter_id,
        "reporter_name": reporter_name,
        "created_at": created.isoformat(),
        "community_reports": [],
        "verdict": "unverified",
        "scam_reports": 0,
        "real_reports": 0,
        "seeded": True,
        "location": {"type": "Point", "coordinates": [lon, lat]},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=30)
    parser.add_argument("--hub", type=str, default=None, choices=list(HUBS.keys()))
    parser.add_argument("--no-clear", action="store_true", help="jangan hapus seed sebelumnya")
    parser.add_argument("--clear-only", action="store_true")
    args = parser.parse_args()

    client = MongoClient(MONGO_URL)
    coll = client[DB_NAME].incidents

    removed = 0
    if not args.no_clear:
        removed = coll.delete_many({"seeded": True}).deleted_count
    print(f"Menghapus {removed} insiden hasil seed sebelumnya.")

    if args.clear_only:
        return

    docs = [make_incident(args.hub) for _ in range(args.count)]
    coll.insert_many(docs)
    print(f"Menyisipkan {len(docs)} insiden acak.")
    by_type = {}
    for d in docs:
        by_type[d["incident_type"]] = by_type.get(d["incident_type"], 0) + 1
    print("Per tipe:", by_type)


if __name__ == "__main__":
    main()
