# Errors on using unbound variables
set -u

# Properly sources the .env file to bring env variables into scope
if [ -f .env ]; then
  eval "$(tr -d '\r' < .env)"
fi

# jq strips away the irrelevant fields we don't care about
curl -sL "${CLIENT_APPLICATION_URI}/api/json/v1" \
--header "Token: ${CLIENT_APPLICATION_TOKEN}" \
--header "Content-Type: application/json" \
--data '{
  "findEmbeddingProviders": {}
}' | jq .status.embeddingProviders
