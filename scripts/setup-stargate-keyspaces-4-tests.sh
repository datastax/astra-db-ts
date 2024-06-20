pp_if_json ()
{
  if echo "$1" | jq -e . >/dev/null 2>&1; then
    echo "$1" | jq .
  else
    echo "$1"
  fi
}

sleep 10

namespaces=$(curl -s -X 'POST' \
               'http://localhost:8181/v1' \
               -H 'accept: application/json' \
               -H 'Token: Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh' \
               -H 'Content-Type: application/json' \
               -d '{
               "findNamespaces": {}
             }')

echo "Response from \`findNamespaces\`:"
pp_if_json "$namespaces"

case "$namespaces" in
  "")
    echo "No response; is stargate running properly?"
    exit 1
    ;;
  \{*)
    ;;
  *)
    echo "Invalid response"
    exit 1
esac

if ! echo "$namespaces" | jq -e '.status.namespaces' >/dev/null 2>&1; then
  echo "Field status.namespaces does not exist"
  exit 1
fi

required_namespaces="default_keyspace other_keyspace"

for required_namespace in $required_namespaces; do
  if ! echo "$namespaces" | jq -e --arg ns "$required_namespace" '.status.namespaces | index($ns)' >/dev/null 2>&1; then
    echo "Namespace '$required_namespace' is missing. Creating..."

    creation_response=$(curl -s -X 'POST' \
                              'http://localhost:8181/v1' \
                              -H 'accept: application/json' \
                              -H 'Token: Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh' \
                              -H 'Content-Type: application/json' \
                              -d "{
                              \"createNamespace\": {
                                \"name\": \"$required_namespace\"
                              }
                            }")

    echo "Response from \`createNamespace { name: \"$required_namespace\" }\`:"
    pp_if_json "$creation_response"
  else
    echo "Namespace '$required_namespace' exists"
  fi
done
