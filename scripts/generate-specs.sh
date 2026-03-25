#!/bin/bash
# Generate spec.md and plan.md from meta.json and research.md

for spec_dir in kitty-specs/*/; do
  name=$(basename "$spec_dir")
  meta="$spec_dir/meta.json"
  research="$spec_dir/research.md"
  spec_file="$spec_dir/spec.md"
  plan_file="$spec_dir/plan.md"
  
  if [[ -f "$meta" ]]; then
    # Extract title from meta.json
    title=$(grep -o '"title"[[:space:]]*:[[:space:]]*"[^"]*"' "$meta" | head -1 | sed 's/.*: "//' | sed 's/"$//')
    id=$(grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' "$meta" | head -1 | sed 's/.*: "//' | sed 's/"$//')
    
    # Generate spec.md if missing
    if [[ ! -f "$spec_file" ]]; then
      cat > "$spec_file" << EOF
# Spec: $title

## Meta

- **ID**: $id
- **Title**: $title
- **Created**: $(date +%Y-%m-%d)
- **State**: in_progress

## Overview

$(if [[ -f "$research" ]]; then head -20 "$research" | tail -15; else echo "See research.md for details"; fi)

## Requirements

- See tasks/ directory for work packages
- See research.md for background and analysis

## Future Work

- Implement features per tasks/
- Verify against acceptance criteria
EOF
      echo "Created $spec_file"
    fi
    
    # Generate plan.md if missing
    if [[ ! -f "$plan_file" ]]; then
      cat > "$plan_file" << EOF
# Plan: $title

## Timeline: 2026 Q1-Q2

## Phase 1: Implementation
- Review research findings
- Implement core features

## Phase 2: Testing
- Unit tests
- Integration tests

## Phase 3: Verification
- Feature completeness
- Documentation

## Dependencies
- AgilePlus spec tooling
- Core runtime dependencies

## Verification
- All tests pass
- Documentation complete
EOF
      echo "Created $plan_file"
    fi
  fi
done
