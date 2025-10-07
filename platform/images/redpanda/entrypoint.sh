#!/bin/sh
set -eu

ADVERTISE_HOST=${REDPANDA_ADVERTISE_HOST:-redpanda.dev.svc.cluster.local}
ADVERTISE_PORT=${REDPANDA_ADVERTISE_PORT:-9092}
ADVERTISE_RPC_HOST=${REDPANDA_ADVERTISE_RPC_HOST:-$ADVERTISE_HOST}
ADVERTISE_RPC_PORT=${REDPANDA_ADVERTISE_RPC_PORT:-33145}

LISTEN_HOST=${REDPANDA_LISTEN_HOST:-0.0.0.0}
LISTEN_PORT=${REDPANDA_LISTEN_PORT:-$ADVERTISE_PORT}
LISTEN_RPC_HOST=${REDPANDA_RPC_LISTEN_HOST:-0.0.0.0}
LISTEN_RPC_PORT=${REDPANDA_RPC_LISTEN_PORT:-$ADVERTISE_RPC_PORT}

SMP=${REDPANDA_SMP:-1}
MEMORY=${REDPANDA_MEMORY:-1G}
RESERVE_MEMORY=${REDPANDA_RESERVE_MEMORY:-0M}

CONFIG_PATH=/etc/redpanda/custom.yaml
mkdir -p "$(dirname "$CONFIG_PATH")"

cat >"$CONFIG_PATH" <<EOF
redpanda:
    data_directory: /var/lib/redpanda/data
    seed_servers: []
    rpc_server:
        address: ${LISTEN_RPC_HOST}
        port: ${LISTEN_RPC_PORT}
    kafka_api:
        - address: ${LISTEN_HOST}
          port: ${LISTEN_PORT}
    admin:
        - address: 0.0.0.0
          port: 9644
    advertised_rpc_api:
        address: ${ADVERTISE_RPC_HOST}
        port: ${ADVERTISE_RPC_PORT}
    advertised_kafka_api:
        - address: ${ADVERTISE_HOST}
          port: ${ADVERTISE_PORT}
    developer_mode: true
    auto_create_topics_enabled: true
    fetch_reads_debounce_timeout: 10
    group_initial_rebalance_delay: 0
    group_topic_partitions: 3
    log_segment_size_min: 1
    storage_min_free_bytes: 10485760
    topic_partitions_per_shard: 1000
rpk:
    overprovisioned: true
    coredump_dir: /var/lib/redpanda/coredump
pandaproxy: {}
schema_registry: {}
EOF

exec /opt/redpanda/bin/redpanda \
  --redpanda-cfg "$CONFIG_PATH" \
  --overprovisioned \
  --lock-memory=false \
  --smp="$SMP" \
  --memory="$MEMORY" \
  --reserve-memory="$RESERVE_MEMORY" \
  --unsafe-bypass-fsync=true
