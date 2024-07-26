# (parallel) unit.testing

## abc (1016ms)

```ts
AssertionError [ERR_ASSERTION]: afsdasdadsaasdfs
    at Object.<anonymous> (tests/unit/testing.test.ts:21:12)
    at runNextTicks (node:internal/process/task_queues:60:5)
    at listOnTimeout (node:internal/timers:540:9)
    at processTimers (node:internal/timers:514:7)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 0)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: undefined,
  expected: undefined,
  operator: 'fail'
}
```

## 123 (1017ms)

```ts
AssertionError [ERR_ASSERTION]: afsdaasdfs
    at Object.<anonymous> (tests/unit/testing.test.ts:26:12)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 1)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: undefined,
  expected: undefined,
  operator: 'fail'
}
```
# unit.testing2

## abc (1002ms)

```ts
AssertionError [ERR_ASSERTION]: afsdasdadsaasdfs
    at Context.<anonymous> (tests/unit/testing2.test.ts:21:12) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: undefined,
  expected: undefined,
  operator: 'fail'
}
```

## 123 (1001ms)

```ts
AssertionError [ERR_ASSERTION]: afsdaasdfs
    at Context.<anonymous> (tests/unit/testing2.test.ts:26:12) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: undefined,
  expected: undefined,
  operator: 'fail'
}
```