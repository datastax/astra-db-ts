# Gracefully stops the docker containers if anything goes wrong
cleanup() {
  docker-compose -f scripts/docker-compose-stargate.yml down
}
trap cleanup EXIT

# Starts the containers in detached mode so we can set up things as necessary
docker-compose -f scripts/docker-compose-stargate.yml up -d

# Sleeps 10s to give the containers some extra time to properly start working
sleep 10

# Idempotently sets up 'default_keyspace' and 'other_keyspace' (as required for the astra-db-ts test suite)
sh scripts/setup-stargate-keyspaces-4-tests.sh

# Reconnects to the running containers so we can easily exit the script on Ctrl+C
docker-compose -f scripts/docker-compose-stargate.yml up
