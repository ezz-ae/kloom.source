# Uncensored LLM endpoint — RunPod Serverless (vLLM, OpenAI-compatible)

This stands up the **no-restriction** half of Kloom's intent-routed backend: a
self-hosted open-weights model on a **scale-to-zero** GPU. Only adult / dark /
explicit / unrestricted turns route here (see `lib/llm-backends.ts` +
`UNCENSORED_LLM_BASE_URL`); everything else stays on the cheap cloud model.

You pay **per second of active generation only** — $0 when idle. Cold start
(~15–40s) happens on the first request after idle; use a network volume (below)
or bake the model (Dockerfile) to keep it short.

> Safety: Kloom's intent gate (`lib/intent.ts`) blocks CSAM + operational-harm
> **before** any model call, so this endpoint only ever receives lawful content.

---

## Fastest path (no Docker build) — ~15 minutes

RunPod ships a prebuilt vLLM worker that already exposes OpenAI-compatible
routes. You only configure it in the console.

### 1. Create the serverless endpoint
1. RunPod → **Serverless** → **New Endpoint** → **Quick Deploy → vLLM**
   (worker image `runpod/worker-v1-vllm`).
2. **Model:** set `MODEL_NAME` to an uncensored open model. Recommended (matches
   the persona tuning already in this repo, fits a 24 GB GPU in fp16):
   ```
   Sao10K/L3-8B-Stheno-v3.2
   ```
   Other good options: `TheDrummer/...` RP models, or any abliterated Qwen/Llama.

### 2. Worker env (set in the endpoint config)
| Key | Value | Why |
|-----|-------|-----|
| `MODEL_NAME` | `Sao10K/L3-8B-Stheno-v3.2` | the served model |
| `MAX_MODEL_LEN` | `8192` | context window (raise if the GPU allows) |
| `DTYPE` | `float16` | fits 24 GB |
| `GPU_MEMORY_UTILIZATION` | `0.92` | use most of VRAM |
| `HF_TOKEN` | *(only if the model is gated)* | model download auth |

### 3. GPU + scaling
- **GPU:** 24 GB class — **RTX 4090 / A5000 / L4** (cheapest that runs an 8B fp16).
- **Min workers: `0`** (scale to zero → $0 idle). **Max workers: `1`** to start.
- Enable **FlashBoot** (faster cold starts).
- **(Recommended) Attach a Network Volume** (~20 GB) and point the model cache at
  it, so the model isn't re-downloaded every cold start.

### 4. Grab the connection details
Once the endpoint is live, its OpenAI base URL is:
```
https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1
```
API key = your **RunPod API key** (Settings → API Keys).

### 5. Test it
```bash
BASE_URL="https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1" \
API_KEY="<RUNPOD_API_KEY>" \
MODEL="Sao10K/L3-8B-Stheno-v3.2" \
./deploy/runpod-uncensored/test-endpoint.sh
```
First call may take ~30s (cold start); subsequent calls are fast.

### 6. Point Kloom at it (Vercel → Settings → Environment Variables)
```
UNCENSORED_LLM_BASE_URL=https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1
UNCENSORED_LLM_API_KEY=<RUNPOD_API_KEY>
UNCENSORED_LLM_MODEL=Sao10K/L3-8B-Stheno-v3.2
```
Redeploy. Adult/explicit turns now hit your uncensored model; everything else
stays on `LLM_BASE_URL`. **No code change** — the routing is already shipped.

---

## Advanced: bake the model into the image (fastest cold starts)
Use `Dockerfile` in this folder to pre-download the weights into a custom worker
image (no per-cold-start download). Build, push to a registry, and point the
RunPod endpoint at your image instead of the stock worker. Bigger image, but cold
starts drop to model-load time only. See comments in `Dockerfile`.

---

## Notes
- **Cost control:** min workers `0` = pay only while generating. Add an "active"
  (always-warm) worker later only if cold starts hurt UX at scale.
- **Privacy:** this is *your* GPU — prompts aren't sent to a third-party model
  provider. That's the main reason to graduate here from the token API.
- **Scaling up:** raise Max workers for more concurrency, or move to a dedicated
  Pod when steady volume justifies 24/7. Same env var — repoint and redeploy.
