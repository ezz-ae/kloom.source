# OPTIONAL — advanced: bake the uncensored model into a custom RunPod vLLM
# worker so cold starts skip the weight download entirely.
#
# The "Fastest path" in README.md needs NO Docker at all — just configure the
# stock runpod/worker-v1-vllm in the console. Use this only if cold-start
# download time becomes a problem and you'd rather ship the weights in the image.
#
# Build & push (replace with your registry), then point the RunPod endpoint at it:
#   docker build --platform linux/amd64 \
#     --build-arg MODEL=Sao10K/L3-8B-Stheno-v3.2 \
#     -t <registry>/kloom-uncensored:latest deploy/runpod-uncensored
#   docker push <registry>/kloom-uncensored:latest
#
# NOTE: confirm the current worker image tag on RunPod's docs before building;
# the base image is updated over time.

FROM runpod/worker-v1-vllm:latest

ARG MODEL=Sao10K/L3-8B-Stheno-v3.2
# For gated models, pass --build-arg HF_TOKEN=... and uncomment the ENV below.
# ARG HF_TOKEN
# ENV HF_TOKEN=${HF_TOKEN}

ENV MODEL_NAME=${MODEL} \
    MAX_MODEL_LEN=8192 \
    DTYPE=float16 \
    GPU_MEMORY_UTILIZATION=0.92

# Pre-download the weights into the image layer (instant cold-start load).
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('${MODEL}')"
