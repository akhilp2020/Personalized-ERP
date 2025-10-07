# Repo Knowledge Packs (Per Service)

This repository uses **per-service knowledge packs** to keep changes cheap and accurate for Codex and humans.

- Global rules: see `docs/codex-playbook.md`
- Validation script: `docs/scripts/validate-docs.sh`
- Service packs live under `docs/services/<svc>/` and include:
  - `kg.yaml` — tiny knowledge graph (service→files, events, DB tables, contracts)
  - `change-map.yaml` — "where to edit" hints for frequent change types
  - `adr/` — short Architecture Decision Records (1–2 pages)

To add a new service pack: `make svc-docs-new SVC=inventory-svc`
To validate all packs: `make docs-validate`
