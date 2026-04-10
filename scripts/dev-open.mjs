import { spawn } from "node:child_process";

const child =
  process.platform === "win32"
    ? spawn("cmd", ["/c", "next", "dev", "--webpack"], {
        stdio: ["inherit", "pipe", "pipe"],
        shell: false,
        env: process.env,
      })
    : spawn("next", ["dev", "--webpack"], {
        stdio: ["inherit", "pipe", "pipe"],
        shell: false,
        env: process.env,
      });

let browserOpened = false;
const url = process.env.DEV_URL ?? "http://localhost:3000";

function openBrowser(targetUrl) {
  if (browserOpened) return;
  browserOpened = true;

  const opener =
    process.platform === "win32"
      ? "start"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";

  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", targetUrl], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return;
  }

  spawn(opener, [targetUrl], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

function handleOutput(data, output) {
  const text = data.toString();
  output.write(text);

  // Next.js normalmente imprime algo como "Ready in ..." quando o servidor sobe.
  if (!browserOpened && /ready in|started server|local:\s*http/i.test(text)) {
    openBrowser(url);
  }
}

child.stdout.on("data", (data) => handleOutput(data, process.stdout));
child.stderr.on("data", (data) => handleOutput(data, process.stderr));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

for (const evt of ["SIGINT", "SIGTERM"]) {
  process.on(evt, () => {
    if (!child.killed) child.kill(evt);
  });
}
