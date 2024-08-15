#!/usr/bin/sh

echo "Copy paste the following into your .env file:"
echo "CLIENT_DB_URL=http://localhost:8181"
echo "CLIENT_DB_TOKEN=Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh"
echo "CLIENT_DB_ENVIRONMENT=dse"
echo

docker-compose -f scripts/docker-compose-stargate.yml up
