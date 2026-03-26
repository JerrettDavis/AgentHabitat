# Redecoration Layer v1 — Sprint Summary

**Lock SHA:** `3c45900` | **Tests:** 22/22 | **Build:** 0 warnings
**Sprint:** 3 slices | **Branch:** `main`

## Overview

The Redecoration Layer adds a non-destructive editing system to AgentHabitat's deterministic world generation. Users can select, move, add, and remove furniture objects in generated worlds while the system enforces placement invariants and preserves the immutable base layout through an override layer.

## Slice History

| Slice | SHA | Scope | Gate |
|-------|-----|-------|------|
| 1 — Edit Primitives | `b316714` | Select/move/add/remove objects, edit mode toggle, action panel | LOCKED |
| 2 — Override Persistence | `a82d3d2` | Base vs user edits separation, save/load/reset, change counter | LOCKED |
| 3 — Validation + Guardrails | `3c45900` | Placement validation, invariant checks, visual cues, schema versioning | LOCKED |

## Features Delivered

### Edit Mode (Slice 1)
- Toggle edit mode from toolbar (orange accent state)
- Click objects to select (dashed orange highlight + type label)
- Move selected object to any valid tile
- Remove selected object
- Add new objects from palette (desk, chair, plant, lamp, bookshelf, couch, table, rug, clock, mug, trash)
- Edit mode status bar with unsaved change counter

### Override Layer (Slice 2)
- Immutable base object snapshot preserved on first render
- Override tracking: `added[]`, `moved{}`, `removed Set`
- Save overrides to JSON (with schema version + timestamp)
- Load overrides from JSON (rehydrates full edit state)
- Reset to base (restores original layout)
- Change count displayed in edit mode banner

### Validation + Guardrails (Slice 3)
- **Pre-edit validation** (`validatePlacement`):
  - Bounds check (object within grid)
  - Walkability check (must be room floor or corridor)
  - Object overlap prevention (no two objects on same tile)
  - Agent overlap prevention (can't place on agent position)
- **Post-edit invariant audit** (`validateInvariants`):
  - Full object bounds + walkability scan
  - Duplicate position detection
  - BFS corridor reachability verification
- **Real-time placement preview**:
  - Green ghost tile + checkmark for valid placements
  - Red ghost tile + X + reason label for invalid placements
  - Cursor changes: `copy` (valid), `not-allowed` (invalid), `crosshair` (edit idle)
- **Post-edit feedback**:
  - Invariant pass/fail banner after every add/move/remove (auto-dismiss 2s)
  - "Check Invariants" button in Blazor edit panel with full error list
  - Save status indicator (pass/fail)
- **Schema versioning**:
  - Saved JSON includes `version: 1`, `savedAt` ISO timestamp, `invariantsPass` flag

## Validation Matrix

| Invariant | Pre-edit | Post-edit | Visual Cue |
|-----------|----------|-----------|------------|
| In bounds | Blocked | Audited | "Out of bounds" label |
| Walkable tile | Blocked | Audited | "Not walkable" label |
| No object overlap | Blocked | Audited | "Object here" label |
| No agent overlap | Blocked | N/A | "Agent here" label |
| Corridor reachability | N/A | BFS audit | Banner warning |
| Determinism (core) | N/A | 22/22 tests | Test suite |

## Files Changed

| File | Role |
|------|------|
| `src/AgentHabitat.Web/wwwroot/js/world-renderer.js` | Canvas renderer + edit mode + validation + override layer |
| `src/AgentHabitat.Web/Components/WorldViewer.razor` | Blazor component + edit panel + validation UI |

## Architecture

```
WorldViewer.razor (Blazor)
  |
  |-- Generate() --> WorldService.cs --> DeterministicWorldGenerator
  |                                       (immutable base)
  |
  |-- Edit Mode --> world-renderer.js
  |     |-- validatePlacement() -----> pre-edit guard
  |     |-- add/move/remove ---------> override layer (added/moved/removed)
  |     |-- validateInvariants() ----> post-edit audit (BFS + overlap + bounds)
  |     |-- saveOverrides() ---------> JSON { version, savedAt, invariantsPass, ... }
  |     |-- loadOverrides() ---------> rehydrate from JSON
  |     '-- resetOverrides() --------> restore base snapshot
  |
  '-- Normal Mode --> room/agent click, pathfinding, minimap
```

## How to Test

```bash
dotnet run --project src/AgentHabitat.Web
```

1. Open `http://localhost:5000`
2. Click **Edit Mode** (toolbar, orange button)
3. Click `+ plant` in the Add Object palette, then click a valid tile (green preview)
4. Try clicking a wall tile (red preview, "Not walkable" label, placement blocked)
5. Select an object, click **Move Selected**, hover to see preview, click valid/invalid tiles
6. Click **Check Invariants** to run full audit
7. Click **Save Layout** to persist (check pass/fail indicator)
8. Click **Reset** to restore original layout
