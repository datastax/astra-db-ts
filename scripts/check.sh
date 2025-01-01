#!/usr/bin/env sh

npx tsc --noEmit --skipLibCheck

npm run lint -- --no-warn-ignored
