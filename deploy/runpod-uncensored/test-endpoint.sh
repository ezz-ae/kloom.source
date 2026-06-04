#!/usr/bin/env bash
#
# Smoke-test an OpenAI-compatible uncensored endpoint (RunPod vLLM worker, a
# local Ollama, or any provider). Verifies the exact request shape Kloom uses.
#
# Usage:
#   BASE_URL="https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1" \
#   API_KEY="<key>" \
#   MODEL="Sao10K/L3-8B-Stheno-v3.2" \
#   ./test-endpoint.sh
#
set -euo pipefail

: "${BASE_URL:?set BASE_URL, e.g. https://api.runpod.ai/v2/<id>/openai/v1}"
: "${API_KEY:?set API_KEY}"
: "${MODEL:?set MODEL, e.g. Sao10K/L3-8B-Stheno-v3.2}"

echo "→ POST ${BASE_URL}/chat/completions  (model: ${MODEL})"
echo "  (first call after idle can take ~30s — cold start)"

resp=$(curl -sS --max-time 120 "${BASE_URL}/chat/completions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"${MODEL}\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Reply with exactly: endpoint ok\"}],
    \"max_tokens\": 16,
    \"temperature\": 0.7,
    \"stream\": false
  }")

echo "── raw response ──"
if command -v jq >/dev/null 2>&1; then echo "$resp" | jq .; else echo "$resp"; fi

# Extract the assistant text without requiring jq
content=$(printf '%s' "$resp" | sed -n 's/.*"content"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
if [ -n "$content" ]; then
  echo "✅ Model replied: ${content}"
else
  echo "⚠️  No content field — check the error above (model name? key? still warming up?)."
  exit 1
fi
