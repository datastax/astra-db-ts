# `premerge.ts` (Handy all-in-one script to ensure everything is good to go)

Pretty much equivalent to:

```sh
./scripts/build.ts -update-report
./scripts/check.ts
./scripts/test.ts -bail
./scripts/set-example-client-deps.ts -tar
```

...but all in one script, so now there's no excuse for me to miss any step.

It'll take maybe 12-15 minutes to run, assuming no steps fail along the way.

## Overriding script arguments

You can override the arguments passed to any of the four scripts by providing any of the following four flags:
- `-build-args` (`-r` by default)
- `-check-args` (empty by default)
- `-test-args` (`-b` by default)
- `-example-deps-args` (`-tar` by default)

For example:

```sh
./scripts/premerge.ts -test-args '-b -local -u'
```

Not sure why you'd really want to do this except for setting the `-local` flag for the tests, but it's there if you need it.

Knock yourself out.

## See also

- [The custom test script](./test.ts.md)
- [The custom check script](./check.ts.md)
- [The custom build script](./build.ts.md)
- [Locking example client deps](./set-example-client-deps.ts.md)
