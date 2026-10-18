#!/usr/bin/env node
// CLI do Brain Organizer. Roda com Node ou com o Electron do app (ELECTRON_RUN_AS_NODE=1).
require('./lib/commands').main(process.argv.slice(2));
