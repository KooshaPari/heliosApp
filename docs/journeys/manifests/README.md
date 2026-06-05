# Journey Manifests

This directory tracks user-facing journey evidence manifests for the
flows declared in `/USER_JOURNEYS.md` and the user-visible requirements
in `/FUNCTIONAL_REQUIREMENTS.md`.

## Manifest Index

| Manifest | Journey | Status | Gap |
| --- | --- | --- | --- |
| `mvp-agent-ide-chat-terminal.md` | UJ-6 | Stub only | Evidence missing. |

## Gap Identified

`/USER_JOURNEYS.md` currently covers generic onboarding, jobs, task
management, collaboration, and settings flows. It does not define
evidence for the repository's primary product flow described by
`/SPEC.md` and `/FUNCTIONAL_REQUIREMENTS.md`: a user opens heliosApp,
starts or resumes an agent chat, observes streaming/tool-call output,
uses an integrated terminal in a lane/session context, and switches or
restores context without losing state.

Add or update manifests here before claiming journey evidence complete.
Each manifest should link to the requirement IDs, journey ID, keyframes,
recordings, and verification commands used for the captured flow.
