#!/usr/bin/env sh

# Errors on using unbound variables
set -u

# Properly sources the .env file to bring env variables into scope
if [ -f .env ]; then
  eval "$(tr -d '\r' < .env)"
fi

# jq strips away the irrelevant fields we don't care about
curl -sL "${CLIENT_DB_URL}/api/json/v1" \
--header "Token: ${CLIENT_DB_TOKEN}" \
--header "Content-Type: application/json" \
--data '{
  "findEmbeddingProviders": {}
}' | jq .status.embeddingProviders
