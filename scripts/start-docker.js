#!/usr/bin/env node
/**
 * Cross-platform Docker startup script
 * Works on Windows and Linux (WSL has limitations when run via bun)
 */

const { execSync, spawn } = require('child_process');
const { existsSync } = require('fs');
const { platform } = require('os');

const CONTAINER_NAME = 'personal-suite-db';
const MAX_WAIT_SECONDS = 90;

function isWindows() {
  return platform() === 'win32';
}

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...options });
  } catch {
    return null;
  }
}

function dockerIsReady() {
  return exec('docker ps') !== null;
}

function containerIsRunning() {
  const result = exec(`docker ps --format "{{.Names}}" --filter "name=${CONTAINER_NAME}"`);
  return result && result.trim() === CONTAINER_NAME;
}

function startDockerDesktopWindows() {
  const dockerPath = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
  if (existsSync(dockerPath)) {
    spawn(dockerPath, [], { detached: true, stdio: 'ignore' }).unref();
    return true;
  }
  return false;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDocker() {
  process.stdout.write('Waiting for Docker to start...');

  for (let i = 0; i < MAX_WAIT_SECONDS; i++) {
    if (dockerIsReady()) {
      console.log('\nDocker is ready!');
      return true;
    }
    process.stdout.write('.');
    await sleep(1000);
  }

  console.log('\n');
  return false;
}

async function main() {
  // Check if Docker CLI is accessible
  if (!dockerIsReady()) {
    if (isWindows()) {
      console.log('Docker not running. Starting Docker Desktop...');
      startDockerDesktopWindows();

      if (!(await waitForDocker())) {
        console.log('Error: Docker failed to start. Please start Docker Desktop manually.');
        process.exit(1);
      }
    } else {
      // On Linux/WSL via bun, docker CLI may not be accessible
      // Check if this is a bun script runner limitation
      console.log('Docker CLI not accessible.');
      console.log('');
      console.log('If running via "bun dev:docker", this is a known bun + WSL limitation.');
      console.log('Please run instead:');
      console.log('  ./scripts/start-docker.sh && bun dev');
      console.log('');
      console.log('Or ensure Docker is running and use:');
      console.log('  bun dev');
      process.exit(1);
    }
  }

  // Start PostgreSQL container
  if (containerIsRunning()) {
    console.log('PostgreSQL container already running');
  } else {
    console.log('Starting PostgreSQL container...');
    const result = exec('docker compose up -d postgres');
    if (result === null) {
      console.error('Failed to start PostgreSQL container');
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
