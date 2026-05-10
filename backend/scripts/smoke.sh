#!/usr/bin/env bash
# Quick checks that the API is up. Run from repo root: backend/scripts/smoke.sh
# Or: cd backend && ./scripts/smoke.sh
set -euo pipefail
HOST="${SMOKE_URL:-http://localhost:8000}"
HOST6="${SMOKE_HOST6:-http://[::1]:8000}"

echo "== GET $HOST/health =="
curl -sfS "$HOST/health" | tee /dev/null
echo ""

echo "== GET $HOST6/health (IPv6 localhost; should 307 to localhost) =="
curl -g -sfS -L "$HOST6/health" | tee /dev/null
echo ""

echo "== GET $HOST/ (HTML landing) =="
code=$(curl -sS -o /dev/null -w '%{http_code}' "$HOST/")
test "$code" = "200" || { echo "FAIL: / returned HTTP $code"; exit 1; }
echo "HTTP $code OK"

echo "== GET $HOST/oauth/github (expect 302) =="
code=$(curl -sS -o /dev/null -w '%{http_code}' "$HOST/oauth/github")
test "$code" = "302" || { echo "FAIL: expected 302, got $code"; exit 1; }
echo "HTTP $code OK"

echo ""
echo "All smoke checks passed."
