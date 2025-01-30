#!/usr/bin/env sh

set -e

if [ -n "$1" ]; then
  sh scripts/utils/help.sh "$1" startgate.sh
  exit $?
fi

if which docker-compose
then
  docker-compose -f scripts/utils/docker-compose-stargate.yml up
else
  docker compose -f scripts/utils/docker-compose-stargate.yml up
fi
