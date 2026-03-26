# Door Generation v1 — Sprint Summary

**Lock SHA:** `eb393cf` | **Tests:** 27/27 | **Build:** 0 warnings
**Sprint:** 2 checkpoints | **Branch:** `main`

## Overview

Door Generation v1 adds first-class door entities to AgentHabitat's deterministic world generation. Doors are topology entities — not decorations — that control traversal between rooms and corridors. Rooms can be adjacent without being accessible. Agents respect door state when pathfinding, enabling privacy, access control, and meaningful spatial behavior.

## Checkpoint History

| Checkpoint | SHA | Scope | Gate |
|------------|-----|-------|------|
| A — Model + Generation | `3e1a37c` | Door entity, generation algorithm, validation, rendering | LOCKED |
| B — Traversal + Semantics | `eb393cf` | Door-aware pathfinding, state toggle, interaction UI | LOCKED |

## Data Model

```csharp
DoorPlacement {
    Id: string           // "door-1", "door-2", ...
    X, Y: int            // Position on room perimeter
    RoomId: string       // Owning room
    Direction: enum      // North, East, South, West
    State: enum          // Open, Closed, Locked
    ConnectsTo: string?  // Target roomId or "corridor"
}
```

## Generation Algorithm

1. After rooms are placed and corridors carved, scan each room's perimeter tiles
2. For each perimeter tile, check if the adjacent outside tile is walkable (corridor or another room)
3. Determine direction from edge position and connection target from adjacent rooms
4. Deduplicate corner tiles that appear on two edges
5. Shuffle candidates with seeded RNG, select 1–3 doors per room based on area
6. Every room is guaranteed at least 1 door

### Door Count Rules
| Room Area | Max Doors |
|-----------|-----------|
| > 60 tiles | 3 |
| > 35 tiles | 2 |
| ≤ 35 tiles | 1 |

## Traversal Rules

| Scenario | Allowed |
|----------|---------|
| Movement within same room | Yes |
| Corridor to corridor | Yes |
| Room ↔ corridor through Open door | Yes |
| Room ↔ corridor through Closed door | No — BLOCKED |
| Room ↔ corridor through Locked door | No — BLOCKED |
| Adjacent rooms without door | No — walls are boundaries |
| Door toggled from Closed to Open | Path becomes available |

## Validation Rules

1. **Min 1 door per room** — every room must have at least one door
2. **Perimeter-only** — doors must be on room boundary tiles
3. **No duplicate positions** — no two doors at same (x, y)
4. **Valid room refs** — door's roomId must exist
5. **50-seed sweep** — all rules verified across 50 random seeds

## Interaction

- **Click door tile** → toggles state: Open → Closed → Locked → Open
- **Hover door tile** → tooltip shows state, direction, connection target
- **Room panel** → door list with colored state badges + toggle buttons
- **Movement blocked** → red "BLOCKED" flash at target tile when path requires closed/locked door

### Visual States
| State | Visual |
|-------|--------|
| Open | Green-tinted opening in door frame |
| Closed | Orange solid fill over door panel |
| Locked | Red X crossbar over door frame |

## Files Changed

| File | Role |
|------|------|
| `WorldGenerationContracts.cs` | DoorPlacement, DoorDirection, DoorState |
| `DeterministicWorldGenerator.cs` | GenerateDoors, FindDoorCandidates |
| `WorldValidation.cs` | Door validation rules (min 1, perimeter, no dupes) |
| `WorldService.cs` | DoorRenderData + WorldRenderData with Doors |
| `WorldViewer.razor` | Door count in stats, door panel in room detail, toggle |
| `world-renderer.js` | Door rendering, door-aware BFS, toggle/state APIs |
| `WorldGenerationTests.cs` | 5 new door tests |

## Architecture

```
DeterministicWorldGenerator
  ├→ PlaceRooms
  ├→ StampRoomsAsWalkable
  ├→ ConnectRoomsWithCorridors
  └→ GenerateDoors (NEW)
       ├→ FindDoorCandidates (perimeter scan)
       ├→ Deduplicate corners
       └→ Seeded selection (1-3 per room)

world-renderer.js (client)
  ├→ Door rendering (frame, handle, state visuals)
  ├→ _buildDoorMap() → position lookup
  ├→ _findRoom() → boundary detection
  ├→ canTraverse(fx,fy,tx,ty) → door-aware check
  ├→ moveAgent() → BFS with canTraverse
  ├→ toggleDoor() / setDoorState() → state mutation
  └→ findDoorAt() → click detection
```

## Test Coverage

| Test | Seeds | What |
|------|-------|------|
| EveryRoomHasAtLeastOneDoor | alpha-001 | Min 1 door per room |
| DoorsAreOnRoomPerimeter | alpha-002 | Perimeter-only placement |
| DoorsAreDeterministic | alpha-001 x2 | Same seed = same doors |
| NoDuplicateDoorPositions | alpha-003 | Position uniqueness |
| AllSeedsHaveDoorsPassingValidation | 50 seeds | Full sweep |
