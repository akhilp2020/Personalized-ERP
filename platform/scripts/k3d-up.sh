#!/usr/bin/env bash
set -euo pipefail
k3d cluster create dev \
  --servers 1 --agents 1 \
  --api-port 6550 \
  -p "80:80@loadbalancer" -p "443:443@loadbalancer" || true
