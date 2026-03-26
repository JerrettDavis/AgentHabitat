# Environment v2 — Pre-populated & Lived-in Worlds

**Milestone HEAD:** `35e18a0` | **Tests:** 22/22 | **Invariants:** all green

## Preset Catalog

| Preset | Seed | Style | Vibe |
|--------|------|-------|------|
| **Startup Office** | `startup-hq` | retro-office | Open-plan startup with coding pods, a war room, and a cozy lounge |
| **Research Lab** | `lab-alpha` | forest-lab | Quiet research facility with library, review room, and green spaces |
| **Cozy Studio** | `studio-zen` | neon-hq | Creative studio with reading nooks, art walls, and ambient lighting |
| **Corporate HQ** | `corp-tower-1` | retro-office | Formal corporate headquarters with executive suites and structured workspaces |

## Room Archetype Kits

### CodingRoom
Desk islands with monitors, whiteboard wall, coffee corner, cable clutter, plant, trash can, wall clock. Designed for focused development work.

### ReviewRoom
Conference table with chair arc, presentation screen, whiteboard, water cooler, bulletin board, papers, plant. Designed for meetings and code review.

### Library
Wall-to-wall bookshelves, reading nook (desk + chair + lamp + rug), globe, clock. Designed for deep research and quiet study.

### Lounge
Couch cluster, coffee table, TV/screen, vending machine, plants, rug, lamp, magazines, coat rack. Designed for breaks and social interaction.

## Object Palette (22 types)

**Furniture:** desk, monitor, chair, table, couch, bookshelf
**Equipment:** whiteboard, screen, coffee, cooler, vending
**Decor:** plant, lamp, rug, mat, clock, globe, bulletin, coatrack
**Clutter:** papers, mug, trash, cables

## Density System

Objects scale with room area:
- Large rooms (60+ tiles): base kit + 4 bonus decorations
- Medium rooms (40+): base kit + 3 bonus
- Small rooms (25+): base kit + 2 bonus
- Tiny rooms: base kit + 1 bonus

Bonus types drawn from: plant, papers, mug, trash, rug, clock, bulletin.
Center walkway is preserved (no bonus placement at room center).

## Corridor Dressing

Sparse deterministic decoration at hash-based intervals:
- Plants every ~23 corridor tiles
- Door mats every ~31 corridor tiles

## Invariants

```
overlap = 0 (pairwise, all seeds)
reachable = true (BFS from room-1, all rooms connected)
in_bounds = true (all rooms within grid)
deterministic = true (100-iteration stability)
tests = 22/22
```

## Sprint History

1. **Archetype Pack v1** (`08fea23`) — curated room kits, 15 new props, corridor dressing
2. **Preset Templates** (`25ff8af`) — 3 named presets with UI selector
3. **Density Tuning + Corporate HQ** (`35e18a0`) — area-scaled bonus props, 4th preset
