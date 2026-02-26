---
work_package_id: "WP09"
subtasks:
  - "T043"
  - "T044"
  - "T045"
  - "T046"
  - "T047"
title: "Formal Protocol Surface Completion"
phase: "Phase 4 - Formal parity"
lane: "planned"
dependencies:
  - "WP08"
assignee: ""
agent: ""
shell_pid: ""
review_status: ""
reviewed_by: ""
history:
  - timestamp: "2026-02-26T13:19:35Z"
    lane: "planned"
    agent: "system"
    shell_pid: ""
    action: "Prompt generated via /spec-kitty.tasks"
---

# Work Package Prompt: WP09 - Formal Protocol Surface Completion

## Objectives & Success Criteria

- Close parity gaps between formal protocol assets in `specs/protocol/v1/` and feature contracts/tasks.
- Enforce ongoing parity with an automated check.

Success criteria:
- Zero unmapped formal methods/topics.
- Extension and defer decisions are explicit and validated.
- Parity check gate is reproducible and fail-closed.

## Context & Constraints

- Formal source: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/specs/protocol/v1/`
- Feature contracts: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/contracts/`
- Plan/tasks/docs for this feature under `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/001-colab-agent-terminal-control-plane/`

Implementation command:
- `spec-kitty implement WP09 --base WP08`

## Subtasks & Detailed Guidance

### Subtask T043 - Build method/topic parity matrix
- Purpose: create an auditable map from formal entries to feature coverage.
- Steps:
  1. Enumerate formal methods/topics.
  2. Map each to contract section, runtime target, and task ID.
  3. Mark entries as implemented/deferred/extension.

### Subtask T044 - Add formal method-family contract coverage
- Purpose: ensure method families are represented in feature contracts.
- Steps:
  1. Cover workspace/project methods.
  2. Cover renderer/agent/approval/share/zmx methods.
  3. Keep phased notes where implementation is deferred.

### Subtask T045 - Add formal event-family coverage mapping
- Purpose: ensure formal event topics are represented and traceable.
- Steps:
  1. Map workspace/project/renderer/agent/approval/share events.
  2. Preserve explicit extension events (`harness.status.changed`, `lane.attached`) as documented deltas.

### Subtask T046 - Add automated parity checker gate
- Purpose: prevent future silent contract drift.
- Steps:
  1. Implement script/test that compares formal and feature surfaces.
  2. Fail on unmapped or undocumented deltas.

### Subtask T047 - Publish parity verification guidance
- Purpose: make parity verification operational for implementers/reviewers.
- Steps:
  1. Add verification commands to quickstart/research/plan docs.
  2. Include examples of valid extension/defer annotations.

## Test Strategy

- Run parity checker locally and in CI.
- Validate checker behavior on known mismatch fixtures.

## Risks & Mitigations

- Risk: parity checker too strict for phased rollout.
- Mitigation: allow explicit defer annotations with required task references.

## Review Guidance

- Verify no formal entry is left unmapped.
- Verify all deltas are explicit and justified.

## Activity Log

- 2026-02-26T13:19:35Z – system – lane=planned – Prompt created.
