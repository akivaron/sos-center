#!/usr/bin/env bash
# Menjalankan backend (FastAPI) + frontend (Expo) sekaligus.
# Usage: ./run.sh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# --- Interpreter Python ---
if command -v python >/dev/null 2>&1; then PY=python; else PY=python3; fi

# --- Aktifkan virtualenv backend jika ada ---
if [ -f "$ROOT/backend/.venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source "$ROOT/backend/.venv/bin/activate"
  PY=python
fi

# --- Preflight: pastikan dependency backend tersedia ---
if ! $PY -c "import uvicorn, fastapi, motor" >/dev/null 2>&1; then
  echo "Dependency backend belum terinstall."
  echo "Jalankan salah satu:"
  echo "  pip install -r backend/requirements.txt"
  echo "  (atau buat venv: python -m venv backend/.venv && source backend/.venv/bin/activate && pip install -r backend/requirements.txt)"
  exit 1
fi

# --- Konfigurasi (bisa di-override lewat environment) ---
export MONGO_URL="${MONGO_URL:-mongodb://localhost:27017}"
export DB_NAME="${DB_NAME:-resq_map}"
BACKEND_URL="${EXPO_PUBLIC_BACKEND_URL:-http://localhost:8000}"
BACKEND_PORT=8000

# --- Backend ---
cd "$ROOT/backend"
echo "==> Menjalankan migrasi & backend di port $BACKEND_PORT"
$PY migrate.py || echo "Migrasi dilewati (jalankan manual jika diperlukan)"
$PY -m uvicorn server:app --reload --host 0.0.0.0 --port "$BACKEND_PORT" &
BACK_PID=$!

# --- Frontend ---
cd "$ROOT/frontend"
export EXPO_PUBLIC_BACKEND_URL="$BACKEND_URL"
echo "==> Menjalankan Expo di $BACKEND_URL"
npx expo start &
FRONT_PID=$!

# --- Cleanup saat script dihentikan ---
trap "echo '==> Menghentikan proses...'; kill $BACK_PID $FRONT_PID 2>/dev/null || true" EXIT INT TERM
wait
