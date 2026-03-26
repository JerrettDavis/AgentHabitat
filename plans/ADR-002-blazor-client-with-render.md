# ADR-002-blazor-client-with-render-abstraction.md

## Status

Accepted

## Date

2026-03-25

## Decision

The primary client for Agent Habitat will be built using **Blazor (Server or WebAssembly)** with a **strict render abstraction layer** that decouples world simulation from rendering implementation.

The system will:

* use Blazor for UI composition, state management, and integration with .NET
* define a rendering abstraction that supports multiple rendering backends
* initially implement a **2D canvas/WebGL renderer** for the world view
* ensure that world state is projected into a render-friendly model rather than directly consumed from domain entities

The render abstraction must allow future support for:

* alternate rendering engines (e.g. Unity, Godot, or custom engines)
* different presentation modes (2D pixel, isometric, minimal UI, headless monitoring)

## Context

Agent Habitat is not a typical CRUD application. It is a living, visual system where:

* agents move through a world
* collaboration is spatial and visible
* work has physical expression
* structural expansion changes the map itself
* users are present inside the system, not outside it

We need a UI stack that:

* integrates tightly with our C#/.NET backend
* supports real-time updates
* allows rapid iteration
* does not force us into a heavyweight game engine prematurely

At the same time, we must avoid coupling core application logic to any specific rendering technology.

## Rationale

### 1. Blazor aligns with the .NET ecosystem

Blazor allows us to:

* share models and contracts across client and server
* reuse validation and typing
* integrate naturally with SignalR
* stay entirely within the .NET toolchain

This reduces friction, especially early in development.

### 2. We are not building a full game engine (yet)

The system is a simulation with visualization, not a physics-driven action game. Starting with Unity or another engine would introduce unnecessary complexity before we validate core product behavior.

Blazor + canvas/WebGL gives us enough power for:

* tile-based world rendering
* interpolated movement
* animation layers
* interaction zones

### 3. Rendering must be replaceable

If the product succeeds, we may want:

* richer visuals
* alternate clients (desktop, mobile, VR, etc.)
* different rendering styles per deployment

A render abstraction ensures we do not bind domain or application logic to a specific UI implementation.

### 4. Projection over direct binding

Domain models are not render models.

We need a projection layer that transforms:

* world state
* occupants
* activities
* objects
* collaboration contexts

into a form optimized for rendering and streaming.

## Architecture

### Client Layers

The client should be structured into:

```text
Client
  UI (Blazor components)
  Application Client Services
  Projection Models
  Render Abstraction
  Render Implementations (Canvas/WebGL)
```

### Render Abstraction

Define interfaces that represent rendering behavior, not implementation details.

Example:

```csharp
public interface IWorldRenderer
{
    Task InitializeAsync(RenderContext context);
    Task RenderFrameAsync(WorldRenderFrame frame);
    Task DisposeAsync();
}

public interface IInputAdapter
{
    Task HandleInputAsync(UserInputEvent input);
}
```

### Render Frame Model

The renderer consumes a flattened, presentation-friendly frame.

```csharp
public sealed record WorldRenderFrame(
    long Tick,
    IReadOnlyCollection<RenderRoom> Rooms,
    IReadOnlyCollection<RenderOccupant> Occupants,
    IReadOnlyCollection<RenderObject> Objects,
    IReadOnlyCollection<RenderEffect> Effects);
```

These are not domain entities. They are projections.

### Projection Pipeline

Server-side or shared logic transforms domain state into render frames.

Flow:

* Domain state changes
* Domain events emitted
* Projection updated
* Render frame produced
* Frame streamed via SignalR
* Client renderer consumes frame

### Rendering Strategy (v1)

* grid-based world
* interpolated movement between grid cells
* layered rendering (floor, objects, occupants, effects)
* sprite-based assets (pixel-art friendly)

## Benefits

### Fast iteration

Blazor enables rapid UI development without leaving the .NET ecosystem.

### Strong typing end-to-end

Shared contracts reduce errors and drift.

### Renderer flexibility

We can evolve visuals without rewriting the system.

### Clean separation of concerns

Domain logic does not leak into rendering.

### Real-time friendly

SignalR integrates naturally with Blazor.

## Drawbacks

### Not a full game engine

We will need to implement some rendering logic ourselves.

### Performance considerations

Canvas/WebGL in Blazor must be used carefully to avoid bottlenecks.

### Potential rework for advanced rendering

If we later adopt a full engine, we will need to build a new renderer implementation.

## Mitigations

### 1. Keep rendering isolated

All rendering logic must live behind interfaces.

### 2. Optimize frame size

Render frames should be minimal and delta-friendly where possible.

### 3. Avoid over-abstracting early

Define only the abstractions we need, but keep them stable.

### 4. Instrument rendering

Measure frame rate, latency, and update frequency.

## Alternatives Considered

### Unity or Godot client

Rejected for v1.

Why:

* higher complexity
* slower iteration
* heavier deployment model

### Pure HTML/CSS DOM rendering

Rejected.

Why:

* insufficient control for animation and spatial layout
* poor fit for continuous movement and layered scenes

### No abstraction, direct Blazor rendering

Rejected.

Why:

* would tightly couple UI and domain
* difficult to replace later

## Consequences

### Positive

* rapid development velocity
* flexible rendering future
* strong alignment with .NET

### Negative

* custom rendering effort required
* possible need for future renderer rewrite

## Follow-On Decisions

* define render model contracts in a shared project
* implement initial canvas/WebGL renderer
* design SignalR streaming for render frames
* create projection services in Application layer

## Implementation Notes

* use a dedicated `RenderFrame` DTO layer
* avoid passing domain entities to the client
* batch updates where possible
* support partial updates later if needed

## Final Statement

We choose Blazor not because it is perfect, but because it is pragmatic.

We choose a render abstraction because we know today’s renderer will not be tomorrow’s renderer.

This gives us speed now, without trapping us later.
