# Journey Manifest Stub — UJ-3 Task and Project Management Workflow

<!-- RICH-MEDIA-STUB: minimal, consistent with hwLedger pattern; full keyframes + recordings deferred until UJ-3 desktop-shell flow is runnable under local capture tooling. -->

**Status:** Stub (not a captured journey)  
**Owner:** heliosApp runtime team  
**Last updated:** 2026-06-05

## Standard

Implements the [phenotype-infra journey-traceability standard](https://github.com/kooshapari/phenotype-infra/blob/main/docs/governance/journey-traceability-standard.md).

## Linked user journey

- `USER_JOURNEYS.md` -> **UJ-3: Task and Project Management Workflow**

## Linked functional requirements

- `FUNCTIONAL_REQUIREMENTS.md` -> **FR-LAN-001** (lane state machine)
- `FUNCTIONAL_REQUIREMENTS.md` -> **FR-PTY-001** (PTY lifecycle state machine)

## Linked tests (representative, see `TEST_COVERAGE_MATRIX.md`)

- `apps/runtime/tests/lanes/state_machine.test.ts` — verifies FR-LAN-001 transitions.
- `apps/runtime/src/pty/__tests__/state_machine.test.ts` — verifies FR-PTY-001 transitions.

## Keyframe capture schedule (planned)

- Project create -> project board open
- Task create -> "To Do" column
- Status change to "In Progress" -> PTY active in lane
- Status change to "Done" -> PTY transitions to stopped/throttled
- Project completion prompt -> archive/close

## Icon set

Inherits heliosApp design-system iconography (TBD, see `docs/operations/journey-traceability.md`).

## Manifest location

- This stub: `docs/journeys/manifests/uj-3-task-project-management.stub.md`
- Rich-media artifacts (keyframe PNGs, WebM/MP4, `manifest.json` per phenotype-journeys schema): pending
  - `docs/journeys/manifests/uj-3-task-project-management/` (empty placeholder)

## CI Gate

Workflow: `.github/workflows/journey-gate.yml` (if present). Status: stub — gate will pass once a real manifest is committed; this stub does not satisfy the gate.

## Notes

- This stub exists only to establish the journey manifest shape for UJ-3 alongside the new `TEST_COVERAGE_MATRIX.md` mapping. It does not include captured keyframes or recordings.
- Do not cite this stub as evidence in any compliance or sign-off report until real artifacts are committed.
