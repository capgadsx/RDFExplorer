set -xeuo pipefail

sed -i "s|GRAPH_API_URL_PLACEHOLDER|'$GRAPH_API_URL'|g" -i public/scripts/controllers/edit.js
node server.js
