# Repository Guidelines

## Project Structure & Module Organization
- `apps/services/order-svc`: Express API that publishes sales events; source lives in `src/`.
- `apps/workers/order-workflows`: Worker stub for asynchronous flows; extend logic in `src/worker.js`.
- `apps/demos/order-ui`: Static HTML demo that targets the API via port-forward.
- `contracts/`: OpenAPI and AsyncAPI definitions plus tenant schemas; treat these as the source of truth.
- `gitops/dev/apps`: Kubernetes manifests applied to the `dev` namespace during deploys.
- `platform/scripts`: Helper scripts for k3d lifecycle and smoke checks; `ops-observability` holds telemetry assets as they land.

## Build, Test, and Development Commands
- `make up`: Provision a local `k3d` cluster, switch kube context, and scaffold the `dev` namespace.
- `npm install` (inside `apps/services/order-svc`): Sync Node dependencies with `package-lock.json`.
- `npm run start` (same directory): Launch the API locally with OpenTelemetry bootstrap.
- `make build`: Build and import service and worker images into the `dev` cluster.
- `make deploy`: Apply manifests from `gitops/dev/apps` into the namespace.
- `make smoke`: Port-forward `order-svc` and post a demo order via curl/JQ.
- `make contracts-lint`: Validate OpenAPI and AsyncAPI specs before pushing.

## Coding Style & Naming Conventions
- Use two-space indentation, trailing semicolons, and prefer single quotes in JS; keep JSON double-quoted.
- Stick to CommonJS modules and arrow functions to match existing service code.
- Name files with lowercase hyphenated words (for example, `order-workflows`), and keep env vars in `SCREAMING_SNAKE_CASE`.
- Update API contracts and manifests alongside code changes that alter behavior.

## Testing Guidelines
- Exercise the API via `make smoke` after deployments; keep `platform/scripts/smoke-order.sh` current.
- When adding Node logic, create Jest request tests under `apps/services/order-svc/tests` and wire an `npm test` script.
- Include workflow simulations for workers as they evolve, keeping fixtures in `apps/workers/order-workflows/testdata`.
- Document manual verification steps in the PR if automation is pending.

## Commit & Pull Request Guidelines
- Follow `<scope>: summary` commit titles (for example, `demo: wire order publisher`), imperative mood, ≤72 characters.
- Group related changes per commit; keep generated artifacts out of version control.
- PRs should state the problem, the solution, affected contracts/manifests, and local verification (`make` targets, screenshots for UI).
- Link to tracking issues or incidents and call out ops impacts, migrations, or new secrets.

## Operations & Environment
- Use the `dev` namespace conventions baked into scripts; avoid hardcoding other namespaces.
- Prefer updating `platform/scripts` or `gitops` overlays instead of editing cluster resources manually.
- Capture required secrets or configmaps in `gitops` or document creation steps in PRs to keep environments reproducible.
