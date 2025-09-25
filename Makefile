.PHONY: up down contracts-lint build deploy smoke

up:
	@./platform/scripts/k3d-up.sh
	@kubectl config use-context k3d-dev
	@kubectl create ns dev --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -k platform/k8s/dev

down:
	@./platform/scripts/k3d-down.sh

contracts-lint:
	npx @redocly/cli@latest lint contracts/openapi/order-svc.yaml || true
	npx @asyncapi/cli@latest validate contracts/asyncapi/sales-events.yaml || true

build:
	docker build -t order-svc:dev apps/services/order-svc
	docker build -t order-workflows:dev apps/workers/order-workflows
	k3d image import order-svc:dev -c dev
	k3d image import order-workflows:dev -c dev

deploy:
	kubectl -n dev apply -f gitops/dev/apps/order-svc.yaml
	kubectl -n dev apply -f gitops/dev/apps/order-workflows.yaml

smoke:
	@./platform/scripts/smoke-order.sh
