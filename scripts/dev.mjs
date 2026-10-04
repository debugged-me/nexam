#!/usr/bin/env node
// Runs the API and web dev servers together with prefixed output.
// Ctrl+C stops both; if either server exits, the other is stopped too.
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const tasks = [
  { name: 'api', color: 36, script: 'dev:api' },
  { name: 'web', color: 35, script: 'dev:web' },
];

const isWindows = process.platform === 'win32';
const children = [];
let running = tasks.length;
let shuttingDown = false;
let exitCode = 0;

function prefixLines(stream, prefix, out) {
  readline.createInterface({ input: stream }).on('line', (line) => out.write(`${prefix} ${line}\n`));
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
}

for (const task of tasks) {
  const prefix = `\x1b[${task.color}m[${task.name}]\x1b[0m`;
  const child = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', task.script], {
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
  });
  prefixLines(child.stdout, prefix, process.stdout);
  prefixLines(child.stderr, prefix, process.stderr);
  child.on('error', (error) => {
    process.stderr.write(`${prefix} failed to start: ${error.message}\n`);
    shutdown(1);
  });
  child.on('close', (code, signal) => {
    if (!shuttingDown) {
      process.stderr.write(`${prefix} exited (${signal ?? code}); stopping the other server.\n`);
      shutdown(code || 1);
    }
    running -= 1;
    if (running === 0) process.exit(exitCode);
  });
  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
