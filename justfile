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

coverage:
  task coverage

docs-index:
  task docs:index

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
