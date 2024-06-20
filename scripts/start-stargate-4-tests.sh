docker-compose -f scripts/docker-compose-stargate.yml up -d

cleanup() {
  docker-compose -f scripts/docker-compose-stargate.yml down
}
trap cleanup EXIT

sh scripts/setup-stargate-keyspaces-4-tests.sh

docker-compose -f scripts/docker-compose-stargate.yml up
