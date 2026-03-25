# Extraction: @phenotype/project

This PR extracts the Project domain package from heliosApp into packages/phenotype-project.

What is included:

- src/ports.ts — ProjectEntity, ProjectFilter, IProjectRepository
- src/entities.ts — Project entity model
- src/service.ts — ProjectDomainService and ProjectService (create/get/list)
- tsconfig.json / package.json — package build and typecheck configs

Goals:
- Provide a clear, testable domain package following hexagonal principles
- Make it easier to add repository adapters (Postgres/InMemory) and wire DI
- Allow other apps in the monorepo to import the domain package

Next steps (follow-up PRs):
1. Implement repository adapters (InMemory for tests, Postgres/TypeORM for production).
2. Wire the package into packages/template-hexagonal DI container.
3. Update existing callers in apps/ to import from `@phenotype/project`.
4. Add unit tests and CI publishing steps.

If you need me to split this into a separate repo, I can prepare a migration plan and export the package history as a standalone repo.
