#!/usr/bin/env bash
set -euo pipefail
kubectl -n dev port-forward svc/order-svc 8085:8080 >/tmp/pf.log 2>&1 &
PF=$!
sleep 1
echo "Creating order..."
curl -s -X POST http://localhost:8085/orders -H "Content-Type: application/json" \
  -d '{"customerId":"C1","currency":"USD","lines":[{"sku":"X","qty":2,"unitPrice":10}]}' | jq .
kill $PF || true
