# Properly sources the .env file to bring env variables into scope
eval "$(tr -d '\r' < .env)"

# Sanity check
if [ -z "${APPLICATION_URI}" ]; then
  echo "Error: APPLICATION_URI is not set."
  exit 1
fi

# Sanity check
if [ -z "${APPLICATION_TOKEN}" ]; then
  echo "Error: APPLICATION_TOKEN is not set."
  exit 1
fi

# jq strips away the irrelevant fields we don't care about
curl -sL "${APPLICATION_URI}/api/json/v1" \
--header "Token: ${APPLICATION_TOKEN}" \
--header "Content-Type: application/json" \
--data '{
  "findEmbeddingProviders": {}
}' | jq .status.embeddingProviders
