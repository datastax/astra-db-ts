eval "$(tr -d '\r' < .env)"

if [ -z "${APPLICATION_URI}" ]; then
  echo "Error: APPLICATION_URI is not set."
  exit 1
fi

if [ -z "${APPLICATION_TOKEN}" ]; then
  echo "Error: APPLICATION_TOKEN is not set."
  exit 1
fi

curl -sL "${APPLICATION_URI}/api/json/v1" \
--header "Token: ${APPLICATION_TOKEN}" \
--header "Content-Type: application/json" \
--data '{
  "findEmbeddingProviders": {}
}' | jq .status.embeddingProviders
