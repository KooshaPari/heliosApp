set shell := ["bash", "-euo", "pipefail", "-c"]

default:
  task --list

preflight:
  task preflight

deps:
  task deps

typecheck:
  task typecheck

lint:
  task lint

test:
  task test

test-e2e-build:
  task test:e2e:build

test-e2e-playwright:
  task test:e2e:playwright

test-e2e:
  task test:e2e

coverage:
  task coverage

docs-index:
  task docs:index

docs-validate:
  task docs:validate

docs-build:
  task docs:build

quality-quick:
  task quality:quick

quality-strict:
  task quality:strict

check:
  task check

ci:
  task ci

governance-required-checks:
  task governance:required-checks

devops-status:
  task devops:status

devops-check:
  task devops:check

devops-check-ci:
  task devops:check:ci

devops-check-ci-summary:
  task devops:check:ci-summary

devops-push *ARGS:
  bash scripts/push-heliosapp-with-fallback.sh {{ARGS}}

devops-push-origin *ARGS:
  bash scripts/push-heliosapp-with-fallback.sh --skip-primary {{ARGS}}

devops-push-queue *ARGS:
  bash scripts/push-heliosapp-with-fallback.sh --queue-only {{ARGS}}

devops-push-drain-queue *ARGS:
  bash scripts/push-heliosapp-with-fallback.sh --drain-queue {{ARGS}}

devops-publish-worker-once *ARGS:
  bash scripts/publish-worker.sh --once {{ARGS}}

devops-publish-worker-loop *ARGS:
  bash scripts/publish-worker.sh {{ARGS}}

devops-checker *ARGS:
  bash scripts/devops-checker.sh {{ARGS}}
