#!/usr/bin/sh

echo "Copy paste the following into your .env file:"
echo "CLIENT_APPLICATION_URI=http://localhost:8181"
echo "CLIENT_APPLICATION_TOKEN=Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh"
echo

docker-compose -f scripts/docker-compose-stargate.yml up
