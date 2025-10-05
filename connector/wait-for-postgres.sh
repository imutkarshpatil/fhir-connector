#!/bin/sh
# connector/wait-for-postgres.sh
set -eu

host="${DB_HOST:-postgres}"
port="${DB_PORT:-5432}"
user="${DB_USER:-postgres}"
timeout="${WAIT_TIMEOUT:-60}"   # seconds

echo "=> waiting for postgres at ${host}:${port} (timeout=${timeout}s)..."
start_ts=$(date +%s)

while true; do
  # 1) Basic TCP check (works on busybox/Alpine)
  if (echo > /dev/tcp/"${host}"/"${port}") >/dev/null 2>&1; then
    # 2) If pg_isready is available, use it for a proper readiness check
    if command -v pg_isready >/dev/null 2>&1; then
      if pg_isready -h "${host}" -p "${port}" -U "${user}" >/dev/null 2>&1; then
        echo "=> postgres ready (pg_isready succeeded)"
        break
      fi
    else
      echo "=> postgres TCP port is open"
      break
    fi
  fi

  now_ts=$(date +%s)
  elapsed=$((now_ts - start_ts))
  if [ "${elapsed}" -ge "${timeout}" ]; then
    echo "ERROR: timed out after ${elapsed}s waiting for Postgres at ${host}:${port}" >&2
    exit 1
  fi

  sleep 1
done

# Execute the passed command (e.g. node index.js)
echo "=> executing: $*"
exec "$@"
