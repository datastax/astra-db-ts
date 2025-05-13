#!/usr/bin/env -S npx tsx

import 'zx/globals';
import { Args } from './utils/arg-parse-v2.js';

new Args('startgate.ts').parse();

if (which.sync('docker-compose', { nothrow: true })) {
  await $`docker-compose -f scripts/utils/docker-compose-stargate.yml up`;
} else {
  await $`docker compose -f scripts/utils/docker-compose-stargate.yml up`;
}
