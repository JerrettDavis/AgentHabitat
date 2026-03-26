# Agent Habitat Spec Backlog (Pre-POC to POC)

## Priority 0 — Must Complete First

### P0.1 2D World Generation Spec Lock
- Status: In Progress
- Owner: Jarvis
- Output: `POC-01-2D-WORLD-GENERATION.md`
- Done when:
  - scope fixed
  - acceptance criteria testable
  - deterministic/perf/visual gates defined

### P0.2 World Validation Rule Catalog
- Define concrete rules:
  - `NoRoomOverlapRule`
  - `AllCriticalRoomsReachableRule`
  - `DoorConnectivityRule`
  - `ObjectWithinBoundsRule`
  - `WalkableCoverageThresholdRule`
- Done when rules have pass/fail examples.

### P0.3 Visual Quality Rubric
- Define scoring rubric (1-5 each):
  - palette coherence
  - clutter control
  - focal readability
  - biome consistency
  - room identity clarity
- Done when rubric can be used in PR review.

## Priority 1 — Build-Enabling Specs

### P1.1 Content Pack Contract
- Define tile/object content pack versioning and deterministic constraints.

### P1.2 Seed Replay Contract
- API/CLI to regenerate world from seed + options + content pack version.

### P1.3 Render Projection Contract
- Explicit `WorldRenderFrame` shape for generated world playback and debug overlays.

### P1.4 POC Demo Script
- Single command to run generation + render + export snapshots.

## Priority 2 — Adjacent Specs (after P0 gate)

### P2.1 Work Projection into World
### P2.2 Collaboration visualization grammar
### P2.3 External host activity patch projection

## Working Agreement

- Every 15–30 minutes: SHA checkpoint or blocker brief.
- No silent cycles.
- No broad implementation before P0 acceptance criteria is locked.
