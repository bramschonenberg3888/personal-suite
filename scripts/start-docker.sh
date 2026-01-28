#!/bin/sh
# Start Docker containers for development
# Note: Run this script manually before 'bun dev' or use 'bun dev:docker'

DOCKER_SOCKET="/var/run/docker.sock"

# Check if Docker is responsive
docker_is_ready() {
  [ -S "$DOCKER_SOCKET" ] && docker ps >/dev/null 2>&1
}

if ! docker_is_ready; then
  echo "Docker not running. Starting Docker Desktop..."
  cmd.exe /c "start \"\" \"C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe\"" 2>/dev/null

  # Wait for Docker to be fully ready (max 90 seconds)
  echo "Waiting for Docker to start..."
  i=0
  while [ $i -lt 90 ]; do
    if docker_is_ready; then
      echo ""
      echo "Docker is ready!"
      break
    fi
    i=$((i + 1))
    if [ $i -eq 90 ]; then
      echo ""
      echo "Error: Docker failed to start within 90 seconds"
      echo "Please ensure:"
      echo "  1. Docker Desktop is running on Windows"
      echo "  2. WSL integration is enabled: Docker Desktop > Settings > Resources > WSL Integration > Ubuntu"
      echo "  3. Restart WSL after enabling integration: wsl --shutdown (from PowerShell)"
      exit 1
    fi
    printf "."
    sleep 1
  done
fi

# Start PostgreSQL container if not running
if ! docker ps --format '{{.Names}}' | grep -q '^personal-suite-db$'; then
  echo "Starting PostgreSQL container..."
  docker compose up -d postgres
else
  echo "PostgreSQL container already running"
fi
