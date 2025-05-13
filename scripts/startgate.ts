#!/usr/bin/env -S npx tsx

import { Opts } from './utils/arg-parse.js';
import 'zx/globals';

new Opts('startgate.ts').parse();

if (which.sync('docker-compose', { nothrow: true })) {
  await $`docker-compose -f scripts/utils/docker-compose-stargate.yml up`;
} else {
  await $`docker compose -f scripts/utils/docker-compose-stargate.yml up`;
}
