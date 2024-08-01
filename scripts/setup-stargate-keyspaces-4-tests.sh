#!/usr/bin/sh

# Uses jq to format/print the input if it's valid JSON
pp_if_json ()
{
  if echo "$1" | jq -e . >/dev/null 2>&1; then
    echo "$1" | jq .
  else
    echo "$1"
  fi
}

# Finds all the current namespaces in the db instance (+ sanity check to make sure stargate's properly running)
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

# Some checks to make sure stargate is actually working
case "$namespaces" in
  "")
    echo "No response; is stargate running properly?"
    exit 1
    ;;
  \{*)
    if ! echo "$namespaces" | jq -e '.status.namespaces' >/dev/null 2>&1; then
      echo "Field status.namespaces does not exist"
      exit 1
    fi
    ;;
  *)
    echo "Invalid response"
    exit 1
esac

# The namespaces to create
required_namespaces="default_keyspace other_keyspace"

# If any required namespace doesn't yet exist, create it
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
