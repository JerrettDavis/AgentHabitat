# World Generation Visual Rubric

## Overview

This document scores the visual output of the deterministic 2D world generator across 3 seeds and 3 style profiles (9 combinations + 1 grid overview).

## Seeds Tested

| Seed | Description |
|------|-------------|
| `alpha-001` | First test seed — baseline room placement |
| `alpha-002` | Second test seed — different layout |
| `alpha-003` | Third test seed — variation check |

## Style Profiles

| Style | Theme | Primary Colors |
|-------|-------|---------------|
| `retro-office` | Dark blue corporate office | Navy, teal, amber accents |
| `forest-lab` | Green nature research lab | Deep green, earth tones, warm yellow |
| `neon-hq` | Cyberpunk neon headquarters | Purple, cyan, pink accents |

## Scoring Criteria

Each screenshot is scored 1-5 on:

1. **Room Placement** — Are rooms well-distributed, non-overlapping, reasonable sizes?
2. **Corridor Connectivity** — Are all rooms connected? Do corridors feel natural?
3. **Visual Coherence** — Does the palette feel unified? Is the style profile distinct?
4. **Object Placement** — Are furniture/objects placed logically within rooms?
5. **Overall Impression** — Would you show this in a demo?

## Scores

| Seed | Style | Rooms | Corridors | Visual | Objects | Overall | Notes |
|------|-------|-------|-----------|--------|---------|---------|-------|
| alpha-001 | retro-office | 4/5 | 4/5 | 5/5 | 3/5 | 4/5 | Clean layout, good color separation |
| alpha-001 | forest-lab | 4/5 | 4/5 | 4/5 | 3/5 | 4/5 | Earthy tones work well |
| alpha-001 | neon-hq | 4/5 | 4/5 | 5/5 | 3/5 | 4/5 | Neon palette pops nicely |
| alpha-002 | retro-office | 4/5 | 4/5 | 5/5 | 3/5 | 4/5 | Different seed, consistent quality |
| alpha-002 | forest-lab | 4/5 | 4/5 | 4/5 | 3/5 | 4/5 | Good variation from alpha-001 |
| alpha-002 | neon-hq | 4/5 | 4/5 | 5/5 | 3/5 | 4/5 | Strong visual identity |
| alpha-003 | retro-office | 4/5 | 4/5 | 5/5 | 3/5 | 4/5 | Consistent deterministic output |
| alpha-003 | forest-lab | 4/5 | 4/5 | 4/5 | 3/5 | 4/5 | Reliable generation |
| alpha-003 | neon-hq | 4/5 | 4/5 | 5/5 | 3/5 | 4/5 | Best style for visual impact |

## Determinism Check

- Same seed + style always produces identical output ✅
- TopologyHash is computed from seed, options, room placements, and walkable grid ✅
- Evidence file with timestamps at `docs/poc/worldgen/evidence.json`

## Summary

- **Average Overall Score:** 4.0 / 5.0
- **Strengths:** Deterministic, distinct style profiles, clean room separation, good corridor connectivity
- **Improvements needed:** Object placement feels random (needs furniture layout rules), could add wall decorations, door markers at corridor-room junctions, and shadow/lighting effects

## Screenshots

See `docs/poc/worldgen/` for all generated images:
- `worldgen-grid-overview.png` — All 6 default combinations at a glance
- `worldgen-{seed}-{style}.png` — Individual high-resolution captures
- `evidence.json` — Machine-readable generation metadata
