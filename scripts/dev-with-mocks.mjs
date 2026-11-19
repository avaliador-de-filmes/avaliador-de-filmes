import { spawn } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SEED_PATH = join(ROOT, "mocks", "db.seed.json");
const DB_PATH = join(ROOT, "mocks", "db.json");
const JSON_SERVER_BIN = join(ROOT, "node_modules", "json-server", "lib", "cli", "bin.js");
const VITE_BIN = join(ROOT, "node_modules", "vite", "bin", "vite.js");
const MOCKS_PORT = 3001;

const flags = new Set(process.argv.slice(2));
const resetOnly = flags.has("--reset-only");
const mocksOnly = flags.has("--mocks-only");

const children = [];
let shuttingDown = false;

function log(message) {
  console.log(`[dev-with-mocks] ${message}`);
}

function fail(message) {
  console.error(`[dev-with-mocks] ${message}`);
  process.exit(1);
}

function resetDatabase() {
  if (!existsSync(SEED_PATH)) {
    fail(`Seed não encontrado em ${SEED_PATH}.`);
  }

  copyFileSync(SEED_PATH, DB_PATH);
  log("Banco local restaurado a partir de mocks/db.seed.json.");
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: "localhost" });

    const finish = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };

    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function killChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }

  child.kill("SIGTERM");
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const { child } of children) {
    killChild(child);
  }

  setTimeout(() => process.exit(exitCode), 300);
}

function spawnChild(args, label) {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  });

  children.push({ child, label });

  child.on("error", (error) => {
    fail(`Falha ao iniciar ${label}: ${error.message}`);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    log(`${label} encerrou (código ${code ?? "n/a"}, sinal ${signal ?? "n/a"}).`);
    shutdown(code ?? 1);
  });

  return child;
}

process.on("SIGINT", () => {
  log("Encerrando processos...");
  shutdown(0);
});

process.on("SIGTERM", () => {
  log("Encerrando processos...");
  shutdown(0);
});

async function main() {
  if (resetOnly) {
    resetDatabase();
    log("Reset concluído.");
    return;
  }

  if (await isPortInUse(MOCKS_PORT)) {
    fail(
      `A porta ${MOCKS_PORT} já está em uso. Encerre o processo e tente novamente.`,
    );
  }

  resetDatabase();

  if (!existsSync(JSON_SERVER_BIN) || !existsSync(VITE_BIN)) {
    fail("Dependências não instaladas. Execute npm install antes de subir o ambiente.");
  }

  spawnChild([JSON_SERVER_BIN, "--watch", "mocks/db.json"], "json-server");

  if (mocksOnly) {
    log(`API local em http://localhost:${MOCKS_PORT}.`);
    return;
  }

  spawnChild([VITE_BIN], "vite");
  log(`API em http://localhost:${MOCKS_PORT} e app via Vite em execução.`);
}

main().catch((error) => fail(error.message));
