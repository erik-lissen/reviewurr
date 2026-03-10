#!/usr/bin/env node

import { startServer } from '../src/server.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  let port = 3456;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      if (isNaN(port)) {
        console.error(`Error: invalid port "${args[i + 1]}"`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
reviewurr - Local code review tool that groups changes by logical flow

Usage:
  reviewurr [--port <port>]

Options:
  --port <port>  Port to listen on (default: 3456)
  --help, -h     Show this help
`);
      process.exit(0);
    }
  }

  return { port };
}

async function main() {
  const { port } = parseArgs(process.argv);
  await startServer(port);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
