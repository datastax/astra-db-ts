#!/usr/bin/env -S npx tsx

import 'zx/globals';
import { Args } from './utils/arg-parse.js';

const args = new Args('startgate.ts')
  .stringEnum('Database', {
    choices: {
      'DSE': ['-dse'],
      'HCD': ['-hcd'],
    }
  })
  .boolean('Detached', {
    flags: ['-d', '-detached'],
    default: false
  })
  .parse();

if (args.Database === undefined) {
  console.error('Error: Database type is required. Use -dse for DSE or -hcd for HCD.');
  process.exit(1);
}

const command = which.sync('docker-compose', { nothrow: true })
  ? 'docker-compose'
  : 'docker compose';

const file = args.Database === 'DSE'
  ? 'scripts/utils/docker-dse/docker-compose.yml'
  : 'scripts/utils/docker-hcd/docker-compose.yml';

const detachedFlag = args.Detached
  ? '-d'
  : '';

$.quote = x => x;
$.sync`${command} -f ${file} up ${detachedFlag}`;
