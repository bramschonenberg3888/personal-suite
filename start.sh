#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

DEFAULT_PORT=3088

# Find a free port starting from DEFAULT_PORT
find_free_port() {
  local port=$1
  while ss -tlnp 2>/dev/null | grep -q ":${port} " || lsof -i ":${port}" &>/dev/null; do
    port=$((port + 1))
  done
  echo "$port"
}

PORT=$(find_free_port "$DEFAULT_PORT")
URL="http://localhost:$PORT"

# Start Docker Desktop if not running
if ! docker info &>/dev/null; then
  echo "Starting Docker Desktop..."
  powershell.exe -Command "Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'" 2>/dev/null
  echo "Waiting for Docker to be ready..."
  until docker info &>/dev/null; do
    sleep 2
  done
  echo "Docker is ready."
fi

# Start PostgreSQL container
echo "Starting database..."
docker compose up -d

# Wait for PostgreSQL to accept connections
echo "Waiting for PostgreSQL..."
until docker exec personal-suite-db pg_isready -U postgres &>/dev/null; do
  sleep 1
done
echo "Database is ready."

# Open browser once dev server is ready (runs in background)
(
  until curl -s -o /dev/null "$URL" 2>/dev/null; do
    sleep 1
  done
  if command -v wslview &>/dev/null; then
    wslview "$URL"
  else
    cmd.exe /c "start $URL" 2>/dev/null
  fi
) &

# Start dev server (this blocks)
echo "Starting dev server at $URL"
export PORT
exec bun dev
