# `startgate.ts` (Local Data API spawning script)

Spins up local Data API & DSE instances using docker compose, for use in development and testing.

Intended usage:

```sh
# Secondary terminal window to spin up a local stargate data api instance
scripts/startgate.ts

# Main terminal window after waiting for stargate to start-gate (heh)
scripts/test.ts -local
```

## See also

- [The custom test script](./test.ts.md)
- [The development REPL](./repl.ts.md)
