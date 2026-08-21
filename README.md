# SOS Center (ResQ Map)

<table>
  <tr>
    <td width="25%">
      <img src="https://github.com/user-attachments/assets/7c0c6567-4fa0-42f9-b7e0-4f2e9ef23a97" alt="image" style="width: 100%; height: auto;" />
    </td>
    <td width="25%">
      <img src="https://github.com/user-attachments/assets/abe8fddf-1c14-49c3-a12b-90fb681ebb03" alt="image" style="width: 100%; height: auto;" />
    </td>
    <td width="25%">
      <img src="https://github.com/user-attachments/assets/556c826a-6504-49a8-b8d0-80d96454d2c6" alt="image" style="width: 100%; height: auto;" />
    </td>
    <td width="25%">
      <img src="https://github.com/user-attachments/assets/927a533d-c3ab-42fd-be54-0cf27619de93" alt="image" style="width: 100%; height: auto;" />
    </td>
  </tr>
</table>


**SOS Center** (ResQ Map) is a disaster response platform that helps people report
emergencies, see nearby incidents on a live map, receive radius-based alerts, and send
SOS signals — even when cellular networks are down, thanks to offline queues and
device-to-device mesh communication (Bluetooth Low Energy & Wi-Fi P2P).

The project is split into two parts:

- **`backend/`** — a FastAPI service backed by MongoDB (via Motor) with managed object
  storage for media (AWS S3 / compatible via `boto3`).
- **`frontend/`** — a cross-platform Expo / React Native app (iOS, Android, Web) built
  with Expo Router, MapLibre/Leaflet maps, and native BLE / Wi-Fi P2P messaging.

---

## Features

- **Live disaster map** — color-coded, category-specific markers (fire, flood, earthquake,
  crash, and more) with a severity dot, horizontal category filters, an incident-count
  badge, and an always-visible legend.
- **Incident detail card** — severity, time, reporter, description, victim count,
  coordinates, assistance needs, and photo evidence (served through a public media
  endpoint bound only to reports).
- **Report wizard** — a 2-step Material Design 3 form: incident type, danger level,
  location, description, victim count, assistance needs, and a required photo.
- **Radius alerts & SOS** — manual and automatic SOS with a countdown and an
  offline-capable send queue.
- **Auth** — Google sign-in and a guest mode.
- **Offline-first mesh chat** — BLE (`react-native-ble-plx`) mesh chat and a Wi-Fi P2P
  scanner for peer-to-peer messaging without internet.
- **Bilingual UI** — Indonesian & English.

---

## Tech Stack

| Layer    | Technology                                                                 |
|----------|----------------------------------------------------------------------------|
| Backend  | Python, FastAPI, Uvicorn, Motor (async MongoDB), boto3 (object storage)     |
| Storage  | MongoDB, S3-compatible object storage                                       |
| Frontend | Expo (SDK ~54), React Native 19, Expo Router, TypeScript                    |
| Maps     | MapLibre React Native, Leaflet                                              |
| Mesh     | react-native-ble-plx (BLE), Wi-Fi P2P scanner                               |
| Auth     | Google OAuth, guest mode (Expo Secure Store / Async Storage)                |
| Design   | Material Design 3 (tonal surfaces, choice chips, extended FAB, nav bar)     |

---

## Repository Layout

```
sos-center/
├── backend/        FastAPI app, migrations, tests, requirements.txt
│   ├── server.py           API entrypoint (Uvicorn)
│   ├── migrate.py          DB migrations
│   ├── seed_incidents.py   Sample data seeding
│   ├── migrations/         Migration scripts
│   ├── tests/              Pytest suite
│   └── requirements.txt
├── frontend/       Expo app (file-based routing under app/)
│   ├── app/                Screens & routes
│   ├── src/                Components, hooks, providers
│   ├── constants/          App-wide constants
│   └── package.json
├── run.sh          Start backend + frontend together
├── stop.sh         Stop the stack
├── tests/          End-to-end / integration test artifacts
└── test_reports/   Validation reports
```

---

## Prerequisites

- **Python** 3.10+ (with `pip`)
- **Node.js** 18+ and **npm** / **yarn**
- **MongoDB** reachable at `mongodb://localhost:27017` (or set `MONGO_URL`)
- **Expo CLI** (installed automatically via `npx expo`)
- For the mesh/BLE and Wi-Fi P2P features: a physical device with Bluetooth/Wi-Fi
  Direct support (these don't work in Expo Go / simulators).

---

## Getting Started

### 1. Backend

```bash
cd backend

# (recommended) create a virtualenv
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# configure environment (defaults shown)
export MONGO_URL="mongodb://localhost:27017"
export DB_NAME="resq_map"
# object storage (S3-compatible) — required for photo uploads
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="..."
export S3_BUCKET="..."
# optional: public media base URL
export MEDIA_BASE_URL="..."

# run migrations + (optional) seed sample data
python migrate.py
python seed_incidents.py

# start the API
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs (Swagger UI)
are at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install

# point the app at the backend
export EXPO_PUBLIC_BACKEND_URL="http://localhost:8000"

npx expo start
```

Open the app using the Expo Dev Client on a device/emulator, or the web target.

---

## Running Everything at Once

From the repository root:

```bash
./run.sh      # starts backend (FastAPI) + frontend (Expo) together
./stop.sh     # stops the stack
```

`run.sh` auto-detects the backend virtualenv and defaults `MONGO_URL` /
`DB_NAME` / `EXPO_PUBLIC_BACKEND_URL` if they aren't already set in the environment.

---

## Environment Variables

| Variable                  | Default                       | Description                          |
|---------------------------|-------------------------------|--------------------------------------|
| `MONGO_URL`               | `mongodb://localhost:27017`   | MongoDB connection string            |
| `DB_NAME`                 | `resq_map`                    | Database name                        |
| `EXPO_PUBLIC_BACKEND_URL` | `http://localhost:8000`       | Backend base URL used by the app     |
| `AWS_ACCESS_KEY_ID`       | —                             | Object storage access key            |
| `AWS_SECRET_ACCESS_KEY`   | —                             | Object storage secret key            |
| `AWS_REGION`              | —                             | Object storage region                |
| `S3_BUCKET`               | —                             | Bucket for report media              |
| `MEDIA_BASE_URL`          | —                             | Public base URL for served media     |

---

## Testing & Validation

- **Backend** — `pytest` inside `backend/` (see `backend/pytest.ini` and
  `backend/tests/`). Targets a clean MongoDB fixture database.
- **Frontend** — `npm run lint` (Expo ESLint) and `tsc` type checks.
- **Reports** — `test_result.md` and `test_reports/` hold the validation history
  (backend 20/20, Expo Doctor, TypeScript/lint checks, and UI flows at 390×844).

---

## Notes

- Photo uploads store only metadata + `photo_file_id` in MongoDB; the binary is kept
  in object storage. Guest users can view evidence through a public endpoint that
  serves only media already attached to a report.
- BLE mesh chat and Wi-Fi P2P scanning require native device capabilities and won't
  function inside Expo Go or simulators — use a development build.

---

## License

Licensed under the [Apache License, Version 2.0](./LICENSE).

Copyright &copy; 2026 Isna Nur Azis. Licensed under the Apache License, Version 2.0 (the "License"); you may not use the files in this repository except in compliance with the License.
