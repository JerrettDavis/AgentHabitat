# POC-01: 2D World Generation (First Priority)

## Objective

Prove that Agent Habitat can generate a beautiful, deterministic, extensible 2D world that is visually competitive with games like WorkAdventure/Gather while preserving strong simulation semantics.

This POC is the hard gate before broader orchestration features.

## Scope (In)

- Deterministic seeded world generation
- Tilemap + biome/style profile generation
- Room placement and corridor/path connectivity
- Object placement pass (desks, plants, boards, decor)
- Rule validation (walkability, overlap, bounds)
- Render output in Blazor client via render abstraction
- One-click local demo: generate world from seed and render
- Snapshot/export artifacts for visual review

## Scope (Out)

- Full task orchestration workflows
- External host assignment routing
- Rich social simulation
- Asset diffusion pipelines (beyond curated sprite set)

## North-Star Success Criteria

1. Same seed always produces same map/layout/placements.
2. Generated worlds are structurally valid (no blocked critical paths, no illegal overlap).
3. Visual quality is "showable" (coherent palette, clean composition, non-random-feeling rooms).
4. Generation completes quickly enough for interactive iteration (<2s target on dev box).
5. We can run a repeatable visual benchmark suite and compare outputs over commits.

## Acceptance Criteria

### Functional

- `GenerateWorld(seed, options)` returns a complete world model with:
  - regions
  - rooms
  - corridors/connectors
  - traversable grid
  - object placements
- At least 4 room archetypes generated in v1:
  - CodingRoom
  - ReviewRoom
  - Library
  - Lounge
- Path exists between all required room entrances.

### Determinism

- For fixed `(seed, options, content pack version)`, hashes of generated topology match across runs.
- Golden snapshot tests pass on CI for fixed seed set.

### Visual

- Style profile enforces palette + tile grammar (no visual outliers).
- No object clipping outside tile bounds.
- No unreadable clutter in key interaction tiles.

### Performance

- Generation p95 < 2s local dev.
- Render first frame p95 < 500ms after model load.

### Testability

- Property tests for spatial invariants.
- Golden image/snapshot test suite for reference seeds.
- Debug overlay mode for navmesh, room IDs, and collision.

## Behavior and Flow

1. Input seed + style profile + generation options.
2. Build coarse region graph.
3. Place mandatory room archetypes via constraints.
4. Route corridors/connectors.
5. Validate traversability + structural integrity.
6. Place semantic objects by room templates.
7. Run polish pass (spacing, decor density, focal points).
8. Emit world + render frame projections.
9. Persist world + provenance metadata.

## Deliverables

- `IWorldGenerator` + deterministic implementation
- Style/profile config set (`retro-office`, `cozy-tech`, etc.)
- Rule/validator suite (`IWorldValidationRule`)
- Blazor render adapter consuming generated world projection
- Debug tools:
  - seed replay CLI or endpoint
  - navmesh/occupancy overlay
  - generation timing metrics
- POC report with benchmark + gallery of fixed seeds

## Use Cases

1. Developer generates world with seed `alpha-001` and gets stable output each run.
2. Reviewer switches style profile and sees coherent visual shift with same topology.
3. CI catches regression where corridor connectivity breaks on seed set.
4. Team can compare before/after visual snapshots on PR.

## Team Execution Split (while claude-squad remains primary)

- Jarvis: spec/acceptance criteria, invariants, validation rules, test matrix
- ClaudeBot: visual quality pass, room template grammar, snapshot gallery automation
- copilot-agent: implementation lane for generator plumbing + perf instrumentation

No lane should block claude-squad critical path; this runs as scoped prep work.

## Risks and Mitigations

- Risk: output feels procedural/noisy
  - Mitigation: style grammar + composition heuristics + focal-point rules
- Risk: deterministic drift after refactors
  - Mitigation: seeded golden snapshots + topology hashing in CI
- Risk: beautiful but non-playable maps
  - Mitigation: hard validation gates before render/persist

## Exit Gate to Start Broader PoC Build

Proceed only when:
- all acceptance criteria above pass
- benchmark + visual gallery reviewed by team
- deterministic test pack green in CI
