# Errors on using unbound variables
set -u

# Properly sources the .env file to bring env variables into scope
eval "$(tr -d '\r' < .env)"

# jq strips away the irrelevant fields we don't care about
curl -sL "${APPLICATION_URI}/api/json/v1" \
--header "Token: ${APPLICATION_TOKEN}" \
--header "Content-Type: application/json" \
--data '{
  "findEmbeddingProviders": {}
}' | jq .status.embeddingProviders
