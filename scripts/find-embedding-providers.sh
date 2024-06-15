eval "$(tr -d '\r' < .env)"

if [ -z "${ASTRA_URI}" ]; then
  echo "Error: ASTRA_URI is not set."
  exit 1
fi

if [ -z "${APPLICATION_TOKEN}" ]; then
  echo "Error: APPLICATION_TOKEN is not set."
  exit 1
fi

curl -sL "${ASTRA_URI}/api/json/v1" \
--header "Token: ${APPLICATION_TOKEN}" \
--header "Content-Type: application/json" \
--data '{
  "findEmbeddingProviders": {}
}' | jq
