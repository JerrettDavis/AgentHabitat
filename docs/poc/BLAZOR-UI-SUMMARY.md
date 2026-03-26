# AgentHabitat — Blazor UI Summary

**HEAD:** `22be1d2` | **Tests:** 22/22 | **Repo:** https://github.com/JerrettDavis/AgentHabitat

## Design System: "Control-room Craft"

Rich tinted neutrals, strong typography hierarchy, intentional panel rhythm, state-driven motion only.

### CSS Tokens (`habitat.css`)
- **Backgrounds:** 6-level tinted dark scale (void → hover)
- **Text:** 4-level hierarchy (primary → dim)
- **Spacing:** 8px base rhythm (4px → 32px)
- **Accents:** blue, green, orange, purple, red
- **Typography:** heading (700 20px), subhead (600 13px), body (400 12px), caption (400 11px), mono (400 11px)

## Features

| Feature | Status |
|---------|--------|
| Deterministic world generation (C# backend) | ✅ |
| 3 visual themes (retro-office, forest-lab, neon-hq) | ✅ |
| Theme-tinted directional lighting | ✅ |
| Pixel-art furniture (7 types) | ✅ |
| Heightmap-lit chibi agents | ✅ |
| Room drop shadows + corner accents | ✅ |
| Room click → detail panel (agents, furniture) | ✅ |
| Agent click → detail modal (role, status, position) | ✅ |
| Right-click pathfinding movement (BFS) | ✅ |
| Path preview + trail + completion flash | ✅ |
| Selection clarity (agent/room/deselect mutual exclusion) | ✅ |
| Movement state UX (moving label, dest marker, action lock) | ✅ |
| Hover tooltips on agents and rooms | ✅ |
| Minimap with toggle | ✅ |
| Responsive layout (desktop → mobile) | ✅ |
| Modal animations (slide-up + backdrop) | ✅ |
| Idle animation loop | ✅ |

## Architecture

```
AgentHabitat.Core        → DeterministicWorldGenerator + WorldValidation
AgentHabitat.Web         → Blazor WASM + WorldViewer component
  WorldService.cs        → C# generator → WorldRenderData DTO
  world-renderer.js      → Canvas rendering + interaction handlers
  habitat.css            → Design system tokens + component styles
AgentHabitat.Core.Tests  → 22 deterministic tests
```

## How to Run

```bash
dotnet run --project src/AgentHabitat.Web
```

Open `http://localhost:5000`, enter seed, pick style, click Generate.

## Design Sprint History

1. **Slice 1** — Visual system (tokens, typography, spacing) `8d4f10d`
2. **Slice 2** — Layout composition (canvas hero, responsive) `2c981a3`
3. **Slice 3** — Interaction polish + Blazor chrome removal `22be1d2`
