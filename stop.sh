#!/usr/bin/env bash
# Menghentikan backend (uvicorn :8000) dan frontend Expo yang dijalankan oleh run.sh.
# Usage: ./stop.sh
set -e

# Port yang dipakai run.sh
BACKEND_PORT="${BACKEND_PORT:-8000}"
EXPO_PORTS=(19000 19001 19002 8081)

echo "==> Menghentikan proses pada port yang dipakai run.sh"

# Hentikan proses berdasarkan port (macOS / Linux dengan lsof)
kill_by_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "    port $port -> PID: $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
}

kill_by_port "$BACKEND_PORT"
for p in "${EXPO_PORTS[@]}"; do
  kill_by_port "$p"
done

# Hentikan juga proses yang biasa di-spawn run.sh (fallback kalau port gagal terdeteksi)
for proc in "uvicorn server:app" "expo start" "metro"; do
  pkill -f "$proc" 2>/dev/null && echo "    killed: $proc" || true
done

sleep 1

# Pastikan benar-benar mati (force kill jika masih hidup)
for port in "$BACKEND_PORT" "${EXPO_PORTS[@]}"; do
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "    force kill port $port -> PID: $pids"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
done

echo "==> Selesai."
