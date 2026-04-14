#!/bin/bash
# Creates an npm proxy repository in Nexus so Docker builds
# can fetch packages over HTTP (avoids SSL cipher errors)

NEXUS_URL="http://192.168.1.111:8081"
NEXUS_USER="admin"
NEXUS_PASS="admin@123"

echo "Creating npm-proxy repository in Nexus..."
curl -u "${NEXUS_USER}:${NEXUS_PASS}" \
  -X POST "${NEXUS_URL}/service/rest/v1/repositories/npm/proxy" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "npm-proxy",
    "online": true,
    "storage": {
      "blobStoreName": "default",
      "strictContentTypeValidation": true
    },
    "proxy": {
      "remoteUrl": "https://registry.npmjs.org",
      "contentMaxAge": 1440,
      "metadataMaxAge": 1440
    },
    "httpClient": {
      "blocked": false,
      "autoBlock": true
    },
    "negativeCache": {
      "enabled": true,
      "timeToLive": 1440
    }
  }'

echo ""
echo "Testing npm-proxy..."
curl -s -o /dev/null -w "HTTP %{http_code}" "${NEXUS_URL}/repository/npm-proxy/"
echo ""
echo ""
echo "npm registry URL: ${NEXUS_URL}/repository/npm-proxy/"
