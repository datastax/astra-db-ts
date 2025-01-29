#!/usr/bin/env sh

set -e

if which docker-compose
then
  docker-compose -f scripts/utils/docker-compose-stargate.yml up
else
  docker compose -f scripts/utils/docker-compose-stargate.yml up
fi
