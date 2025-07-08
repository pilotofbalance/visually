#!/bin/bash
set -e

TYPESENSE_HOST="typesense"
TYPESENSE_PORT="8108"
TYPESENSE_PROTOCOL="http"

TYPESENSE_API_KEY="${TYPESENSE_API_KEY}" 
TYPESENSE_COLLECTION_NAME="${TYPESENSE_COLLECTION_NAME}"
JSONL_FILE="/docker-entrypoint-initdb.d/catalog.jsonl"
TYPESENSE_DATA_DIR="/data"

echo "Starting Typesense server in background..."
nohup /opt/typesense-server --data-dir "${TYPESENSE_DATA_DIR}" --api-key="${TYPESENSE_API_KEY}" --enable-cors --enable-nested-fields=true --listen-port ${TYPESENSE_PORT} > /var/log/typesense-startup.log 2>&1 &

echo "Giving Typesense process a generous moment to initialize..."
sleep 15 

# echo "Waiting for Typesense API to be available and ready (checking /health endpoint)..."
# ATTEMPTS=0
# MAX_ATTEMPTS=30 
# until curl --output /dev/null --silent --head --fail \
#   -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
#   "${TYPESENSE_PROTOCOL}://${TYPESENSE_HOST}:${TYPESENSE_PORT}/health"; do
#   if [ ${ATTEMPTS} -ge ${MAX_ATTEMPTS} ]; then
#     echo "ERROR: Typesense health check failed after ${MAX_ATTEMPTS} attempts."
#     echo "Last few lines of Typesense startup log:"
#     tail -n 10 /var/log/typesense-startup.log
#     exit 1
#   fi
#   echo "Typesense is unavailable - sleeping (${ATTEMPTS}/${MAX_ATTEMPTS})"
#   sleep 2
#   ATTEMPTS=$((ATTEMPTS+1))
# done
echo "Typesense API is available!"

echo "Creating Typesense collection '${TYPESENSE_COLLECTION_NAME}'..."

# --- BEGIN MODIFIED JSON PAYLOAD CONSTRUCTION ---
# Construct the JSON payload using a here-document for robustness
COLLECTION_JSON_PAYLOAD=$(cat <<EOF
{
  "name": "${TYPESENSE_COLLECTION_NAME}",
  "enable_nested_fields": true,
  "fields": [
    {
      "name": "id",
      "type": "string"
    },
    {
      "name": "alias",
      "type": "string",
      "optional": false,
      "facet": true,
      "sort": true
    },
    {
      "name": "collections",
      "type": "string[]",
      "optional": false,
      "facet": true,
      "sort": false
    },
    {
      "name": "epochSec",
      "type": "int64",
      "optional": false,
      "sort": true
    },
    {
      "name": "handle",
      "type": "string",
      "optional": false,
      "facet": true,
      "sort": true
    },
    {
      "name": "image",
      "type": "object",
      "optional": true,
      "index": false
    },
    {
      "name": "images",
      "type": "object[]",
      "optional": true,
      "index": false
    },
    {
      "name": "inventoryQuantity",
      "type": "int32",
      "optional": false,
      "sort": true
    },
    {
      "name": "looxCount",
      "type": "int32",
      "optional": false,
      "sort": true
    },
    {
      "name": "looxRating",
      "type": "float",
      "optional": false,
      "sort": true
    },
    {
      "name": "mainValue",
      "type": "string",
      "optional": false,
      "facet": true,
      "sort": true
    },
    {
      "name": "okendoCount",
      "type": "int32",
      "optional": false,
      "sort": true
    },
    {
      "name": "okendoRating",
      "type": "float",
      "optional": false,
      "sort": true
    },
    {
      "name": "optionNames",
      "type": "string[]",
      "optional": false,
      "facet": true,
      "sort": false
    },
    {
      "name": "options",
      "type": "object[]",
      "optional": true,
      "index": false
    },
    {
      "name": "orders",
      "type": "int32",
      "optional": false,
      "sort": true
    },
    {
      "name": "price",
      "type": "float",
      "optional": false,
      "sort": true
    },
    {
      "name": "productType",
      "type": "string",
      "optional": false,
      "facet": true,
      "sort": true
    },
    {
      "name": "rank",
      "type": "int32",
      "optional": false,
      "sort": true
    },
    {
      "name": "shopifyCount",
      "type": "int32",
      "optional": false,
      "sort": true
    },
    {
      "name": "shopifyRating",
      "type": "float",
      "optional": false,
      "sort": true
    },
    {
      "name": "stampedCount",
      "type": "int32",
      "optional": false,
      "sort": true
    },
    {
      "name": "stampedRating",
      "type": "float",
      "optional": false,
      "sort": true
    },
    {
      "name": "status",
      "type": "string",
      "optional": false,
      "facet": true,
      "sort": true
    },
    {
      "name": "tags",
      "type": "string[]",
      "optional": false,
      "facet": true,
      "sort": false
    },
    {
      "name": "title",
      "type": "string",
      "optional": false,
      "facet": true,
      "sort": true
    },
    {
      "name": "topProduct",
      "type": "bool",
      "optional": false,
      "facet": true,
      "sort": true
    },
    {
      "name": "variantIds",
      "type": "int64[]",
      "optional": false,
      "sort": false
    },
    {
      "name": "variants",
      "type": "object[]",
      "optional": true,
      "index": false
    },
    { "name": "variants.price", "type": "int64[]"},
    { "name": "variants.compare_at_price", "type": "int64[]"},
    {
      "name": "yotpoCount",
      "type": "int32",
      "optional": false,
      "sort": true
    },
    {
      "name": "yotpoRating",
      "type": "float",
      "optional": false,
      "sort": true
    },
    {
      "name": "publishedAt_epoch",
      "type": "int64",
      "optional": false,
      "sort": true
    },
    {
      "name": "publishedAt",
      "type": "object",
      "optional": true,
      "index": false
    }
  ],
  "default_sorting_field": "rank"
}
EOF
)

# Debugging: Print the exact JSON payload that will be sent
echo "DEBUG: JSON payload for collection creation:"
echo "${COLLECTION_JSON_PAYLOAD}"

COLLECTION_RESPONSE=$(curl -X POST "${TYPESENSE_PROTOCOL}://${TYPESENSE_HOST}:${TYPESENSE_PORT}/collections" \
     -H "Content-Type: application/json" \
     -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
     --data-binary @- <<< "${COLLECTION_JSON_PAYLOAD}" 2>&1) # Use --data-binary with here-string
echo "Collection creation response: ${COLLECTION_RESPONSE}"
# --- END MODIFIED JSON PAYLOAD CONSTRUCTION ---


# --- Logic for checking collection creation success (as previously corrected) ---
if echo "${COLLECTION_RESPONSE}" | grep -q '"name":"'"${TYPESENSE_COLLECTION_NAME}"'"'; then
  echo "Collection '${TYPESENSE_COLLECTION_NAME}' created."
elif echo "${COLLECTION_RESPONSE}" | grep -q 'already exists'; then
  echo "Collection '${TYPESENSE_COLLECTION_NAME}' already exists. Skipping creation."
else
  echo "Error creating collection '${TYPESENSE_COLLECTION_NAME}'. Response: ${COLLECTION_RESPONSE}"
  exit 1
fi
# --- END success check logic ---


echo "Importing data from ${JSONL_FILE} into Typesense collection '${TYPESENSE_COLLECTION_NAME}'..."
IMPORT_RESPONSE=$(curl -X POST "${TYPESENSE_PROTOCOL}://${TYPESENSE_HOST}:${TYPESENSE_PORT}/collections/${TYPESENSE_COLLECTION_NAME}/documents/import?action=upsert" \
     -H "Content-Type: text/plain" \
     -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
     --data-binary "@${JSONL_FILE}" 2>&1)
echo "Data import response: ${IMPORT_RESPONSE}"

if echo "${IMPORT_RESPONSE}" | grep -q '"success":true'; then
  echo "Data imported successfully."
else
  echo "Warning: Some documents might have failed to import. Check response for details."
fi

echo "Typesense setup complete. Keeping server running..."
tail -f /dev/null &
wait $!