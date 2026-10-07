import { spawn, exec } from "child_process";
import readline from "readline";
import net from "net";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

// ANSI Colors
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgDark: "\x1b[40m",
};

let dbProcess = null;
let devProcess = null;
let studioProcess = null;
let dbStatus = "Checking...";
let webStatus = "Checking...";
let showLogs = true;
let logBuffer = [];
const MAX_LOGS = 8;

function addLog(source, data) {
  const lines = data.toString().split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    logBuffer.push(`[${source}] ${line}`);
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  }
  if (showLogs) {
    render();
  }
}

function checkPort(port, host = "127.0.0.1", timeout = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeout);
    socket.once("connect", () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

function openBrowser(url) {
  const startCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  exec(`${startCmd} ${url}`);
}

function getDbConfig() {
  const envPath = path.join(ROOT_DIR, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const m = content.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    if (m && m[1]) {
      const url = m[1];
      const isLocal = url.includes("127.0.0.1") || url.includes("localhost");
      const isSupabase = url.includes("supabase.com");
      return { isLocal, isSupabase, url };
    }
  }
  return { isLocal: true, isSupabase: false, url: "" };
}

async function updateStatuses() {
  const dbCfg = getDbConfig();
  if (dbCfg.isSupabase) {
    dbStatus = `${C.green}● Cloud Connected${C.reset} (Supabase AWS)`;
  } else if (!dbCfg.isLocal) {
    dbStatus = `${C.green}● Remote Connected${C.reset} (Custom Database)`;
  } else {
    const isDbUp = await checkPort(54329);
    dbStatus = isDbUp ? `${C.green}● Online${C.reset} (Local PGLite 54329)` : `${C.red}○ Offline${C.reset}`;
  }

  const isWebUp = await checkPort(3000);
  webStatus = isWebUp ? `${C.green}● Online${C.reset} (http://localhost:3000)` : `${C.yellow}○ Starting / Waiting...${C.reset}`;

  return { isWebUp };
}

function startDb() {
  const dbCfg = getDbConfig();
  if (!dbCfg.isLocal) {
    dbStatus = `${C.green}● Cloud Connected${C.reset} (${dbCfg.isSupabase ? "Supabase" : "Remote"})`;
    return;
  }
  if (dbProcess) return;
  dbStatus = `${C.yellow}⟳ Starting Local PGLite...${C.reset}`;
  dbProcess = spawn("npm.cmd", ["run", "db:local"], {
    cwd: ROOT_DIR,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  dbProcess.stdout?.on("data", (d) => addLog("DB", d));
  dbProcess.stderr?.on("data", (d) => addLog("DB", d));

  dbProcess.on("exit", (code) => {
    dbProcess = null;
    dbStatus = `${C.red}○ Stopped (exit ${code})${C.reset}`;
    render();
  });
}

function startDev() {
  if (devProcess) return;
  webStatus = `${C.yellow}⟳ Starting Next.js...${C.reset}`;
  devProcess = spawn("npm.cmd", ["run", "dev"], {
    cwd: ROOT_DIR,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  devProcess.stdout?.on("data", (d) => addLog("NEXT", d));
  devProcess.stderr?.on("data", (d) => addLog("NEXT", d));

  devProcess.on("exit", (code) => {
    devProcess = null;
    webStatus = `${C.red}○ Stopped (exit ${code})${C.reset}`;
    render();
  });
}

function killProcess(proc) {
  if (!proc) return;
  try {
    if (process.platform === "win32" && proc.pid) {
      exec(`taskkill /pid ${proc.pid} /T /F`);
    } else {
      proc.kill("SIGTERM");
    }
  } catch {
    // ignore cleanup errors
  }
}

function cleanExit() {
  console.log(`\n${C.yellow}Shutting down processes cleanly...${C.reset}`);
  killProcess(dbProcess);
  killProcess(devProcess);
  killProcess(studioProcess);
  console.log(`${C.green}All processes stopped. Goodbye!${C.reset}\n`);
  process.exit(0);
}

process.on("SIGINT", cleanExit);
process.on("SIGTERM", cleanExit);
process.on("exit", () => {
  killProcess(dbProcess);
  killProcess(devProcess);
  killProcess(studioProcess);
});

function render() {
  // Clear terminal screen
  process.stdout.write("\x1b[2J\x1b[0;0H");

  console.log(`${C.bold}${C.yellow}╔════════════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.yellow}║          🎰  CASINO PLAYERS CLUB - STARTER CONTROL DASHBOARD       ║${C.reset}`);
  console.log(`${C.bold}${C.yellow}╚════════════════════════════════════════════════════════════════════╝${C.reset}`);
  console.log("");

  console.log(`${C.bold} SYSTEM STATUS:${C.reset}`);
  console.log(`  📦 Local Database (PGLite) : ${dbStatus}`);
  console.log(`  🚀 Web Platform (Next.js)  : ${webStatus}`);
  console.log("");

  console.log(`${C.bold} QUICK URLS:${C.reset}`);
  console.log(`  🌐 Website Frontend : ${C.cyan}http://localhost:3000${C.reset}`);
  console.log(`  🛡️  Admin Portal     : ${C.cyan}http://localhost:3000/admin${C.reset}`);
  console.log(`  ⚙️  Admin Settings   : ${C.cyan}http://localhost:3000/admin/settings${C.reset}`);
  console.log(`  🚨 Risk Dashboard   : ${C.cyan}http://localhost:3000/admin/risk${C.reset}`);
  console.log("");

  if (showLogs) {
    console.log(`${C.dim}--- RECENT LOGS (Press 'L' to hide) ---${C.reset}`);
    for (const l of logBuffer.slice(-8)) {
      console.log(` ${C.dim}${l.slice(0, 80)}${C.reset}`);
    }
    console.log(`${C.dim}----------------------------------------${C.reset}`);
    console.log("");
  }

  console.log(`${C.bold} CONTROL ACTIONS:${C.reset}`);
  console.log(`  ${C.green}[1]${C.reset} 🌐 Open Website in Browser`);
  console.log(`  ${C.green}[2]${C.reset} 🛡️  Open Admin Portal in Browser`);
  console.log(`  ${C.green}[3]${C.reset} 👑 Make a User Admin (Give Admin Rights)`);
  console.log(`  ${C.green}[4]${C.reset} 🗄️  Open Prisma Studio Database GUI`);
  console.log(`  ${C.green}[5]${C.reset} 🔄 Setup / Push Database Schema`);
  console.log(`  ${C.green}[6]${C.reset} ⚡ Restart Next.js Dev Server`);
  console.log(`  ${C.green}[L]${C.reset} 📜 Toggle Logs View (${showLogs ? "ON" : "OFF"})`);
  console.log(`  ${C.red}[Q]${C.reset} 🛑 Stop Everything & Quit`);
  console.log("");
  process.stdout.write(`${C.bold}${C.yellow}Select an option [1-6, L, Q]: ${C.reset}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function promptUser(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function handleAction(key) {
  const k = key.toUpperCase();
  if (k === "1") {
    openBrowser("http://localhost:3000");
  } else if (k === "2") {
    openBrowser("http://localhost:3000/admin");
  } else if (k === "3") {
    const email = await promptUser(`\n${C.yellow}Enter user email to promote to ADMIN: ${C.reset}`);
    if (email) {
      console.log(`\nPromoting ${email}...`);
      exec(`npx tsx scripts/make-admin.ts "${email}"`, { cwd: ROOT_DIR }, (err, stdout, stderr) => {
        if (err) {
          console.log(`${C.red}Error: ${stderr || err.message}${C.reset}`);
        } else {
          console.log(`${C.green}${stdout.trim()}${C.reset}`);
        }
        setTimeout(render, 2500);
      });
      return;
    }
  } else if (k === "4") {
    if (!studioProcess) {
      console.log(`\n${C.cyan}Opening Prisma Studio on http://localhost:5555...${C.reset}`);
      studioProcess = spawn("npm.cmd", ["run", "db:studio"], { cwd: ROOT_DIR, shell: true });
      setTimeout(() => openBrowser("http://localhost:5555"), 3000);
    } else {
      openBrowser("http://localhost:5555");
    }
  } else if (k === "5") {
    console.log(`\n${C.cyan}Running DB schema setup...${C.reset}`);
    exec("npm.cmd run db:push", { cwd: ROOT_DIR }, (err, stdout) => {
      console.log(stdout);
      setTimeout(render, 3000);
    });
    return;
  } else if (k === "6") {
    console.log(`\n${C.cyan}Restarting Next.js...${C.reset}`);
    killProcess(devProcess);
    devProcess = null;
    startDev();
  } else if (k === "L") {
    showLogs = !showLogs;
  } else if (k === "Q") {
    cleanExit();
    return;
  }
  render();
}

async function bootstrap() {
  // Ensure .env exists
  const envPath = path.join(ROOT_DIR, ".env");
  const envExample = path.join(ROOT_DIR, ".env.example");
  if (!fs.existsSync(envPath) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envPath);
    console.log(`${C.green}Created .env from .env.example${C.reset}`);
  }

  render();

  // 1. Check and start Database
  const dbCfg = getDbConfig();
  if (!dbCfg.isLocal) {
    dbStatus = `${C.green}● Cloud Connected${C.reset} (${dbCfg.isSupabase ? "Supabase" : "Remote"})`;
  } else {
    const isDbUp = await checkPort(54329);
    if (!isDbUp) {
      startDb();
    } else {
      dbStatus = `${C.green}● Online${C.reset} (Port 54329)`;
    }
  }
  render();

  // 2. Check and start Next.js Dev Server
  const isWebUp = await checkPort(3000);
  if (!isWebUp) {
    startDev();
  } else {
    webStatus = `${C.green}● Online${C.reset} (http://localhost:3000)`;
    render();
  }

  // Poll port statuses every 2.5 seconds
  setInterval(async () => {
    await updateStatuses();
    render();
  }, 2500);

  // Readline listener
  rl.on("line", (line) => {
    const input = line.trim();
    if (input) handleAction(input);
    else render();
  });

  // When web becomes ready for the first time, open browser
  let hasOpened = false;
  const openerInterval = setInterval(async () => {
    const ready = await checkPort(3000);
    if (ready && !hasOpened) {
      hasOpened = true;
      clearInterval(openerInterval);
      openBrowser("http://localhost:3000");
    }
  }, 1500);
}

bootstrap().catch((err) => {
  console.error("Dashboard error:", err);
  process.exit(1);
});
