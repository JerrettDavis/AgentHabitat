# SYSTEM-ARCHITECTURE.md

## Overview

Agent Habitat is a C#-first, persistent, real-time, generative 2D habitat for autonomous agents and human users. It combines a deterministic world simulation, semantically meaningful spaces, a real work orchestration engine, pluggable generation pipelines, and multiple agent-host integration modes into a single cohesive platform.

The system is designed so that visible world behavior maps to actual runtime behavior. Agents do not merely appear to work. They receive assignments, transition into relevant spaces, collaborate, execute workflows, produce artifacts, and leave lasting traces in the world. The habitat itself can grow structurally from day one, allowing agents and users to shape their environment over time.

This document defines the concrete system architecture for implementation.

## Architectural Objectives

The architecture must:

* support deterministic simulation and replayable world setups
* preserve a strong separation between simulation, semantics, orchestration, generation, and rendering
* support both first-party hosted agents and external tool-hosted agents
* minimize token consumption for external integrations unless free-roam is explicitly enabled
* provide a first-class real-time user experience
* support structural world expansion in the first milestone
* keep generated outputs governed, validated, and traceable
* remain self-hostable, observable, and modular

## Architectural Style

The recommended starting point is a modular monolith with clear internal module boundaries and explicit contracts between them.

This gives the implementation team several advantages. It keeps local development simple, supports Aspire composition cleanly, avoids premature distributed systems overhead, and still leaves room to split modules out later if scaling or operational pressure justifies it.

The modules should behave as bounded components rather than as a pile of shared services. Internal APIs, domain events, integration contracts, and projection models should be treated as stable seams.

## Top-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                              Client Layer                           │
│  Blazor Web App / 2D Renderer / Presence UI / Inspectors / Panels   │
└───────────────▲───────────────────────────────▲─────────────────────┘
                │                               │
                │ SignalR / HTTP                │ Admin / User Actions
                │                               │
┌───────────────┴───────────────────────────────┴─────────────────────┐
│                               API Layer                             │
│  ASP.NET Core APIs / SignalR Hubs / Auth / Session Endpoints        │
└───────────────▲───────────────────────────────▲─────────────────────┘
                │                               │
                │                               │
┌───────────────┴───────────────┐   ┌───────────┴────────────────────┐
│      Projection Layer          │   │     Integration Host Layer     │
│ World read models / diffs /    │   │ MCP / hooks / plugins /        │
│ occupancy / activity streams   │   │ external agent session adapters │
└───────────────▲───────────────┘   └───────────▲────────────────────┘
                │                               │
                │                               │
┌───────────────┴───────────────────────────────┴─────────────────────┐
│                        Application Coordination                      │
│ Commands / workflows / policies / approvals / use-case services      │
└───────────────▲───────────────▲──────────────────▲──────────────────┘
                │               │                  │
                │               │                  │
┌───────────────┴───────┐ ┌─────┴────────────┐ ┌──┴──────────────────┐
│ Simulation Module      │ │ Orchestration    │ │ Generation Foundry  │
│ world state, movement, │ │ tasks, agents,   │ │ assets, layouts,    │
│ rooms, pathing, time   │ │ assignments,     │ │ validation, style    │
│                        │ │ workflows        │ │ enforcement          │
└───────────────▲───────┘ └─────▲────────────┘ └──▲──────────────────┘
                │               │                  │
                └───────┬───────┴──────────┬──────┘
                        │                  │
                 ┌──────┴──────────────────┴──────┐
                 │         Domain + Semantics      │
                 │ entities / rules / policies /   │
                 │ room meaning / object meaning   │
                 └──────▲──────────────────▲──────┘
                        │                  │
                 ┌──────┴──────┐    ┌──────┴─────────────┐
                 │ Persistence  │    │ External Services  │
                 │ Postgres /   │    │ GitHub / files /   │
                 │ Redis / blob │    │ issue trackers /   │
                 │ storage      │    │ generation hosts   │
                 └──────────────┘    └────────────────────┘
```

## Solution Layout

```text
/src
  /AgentHabitat.AppHost
  /AgentHabitat.ServiceDefaults
  /AgentHabitat.Api
  /AgentHabitat.Client
  /AgentHabitat.Contracts
  /AgentHabitat.Domain
  /AgentHabitat.Application
  /AgentHabitat.Simulation
  /AgentHabitat.Semantics
  /AgentHabitat.Orchestration
  /AgentHabitat.Generation
  /AgentHabitat.Infrastructure
  /AgentHabitat.Mcp
  /AgentHabitat.Integrations.GitHub
  /AgentHabitat.Integrations.FileSystem
  /AgentHabitat.Integrations.Issues
  /AgentHabitat.Integrations.ExternalHosts
/tests
  /AgentHabitat.ArchitectureTests
  /AgentHabitat.Domain.Tests
  /AgentHabitat.Application.Tests
  /AgentHabitat.Simulation.Tests
  /AgentHabitat.Semantics.Tests
  /AgentHabitat.Orchestration.Tests
  /AgentHabitat.Generation.Tests
  /AgentHabitat.Api.Tests
/docs
  /adrs
  /architecture
  /plans
  /specs
```

## Module Responsibilities

### AgentHabitat.Domain

Owns core domain types, identifiers, enums, aggregate roots, value objects, core policies, and domain events.

Examples:

* World, Region, Room, WorldObject
* AgentResident, UserResident, OccupantPresence
* WorkItem, CollaborationContext, Artifact, ProvenanceRecord
* WorldSeed, StyleProfile, ActivityState

This project should have no dependency on infrastructure or UI concerns.

### AgentHabitat.Semantics

Owns the meaning system that binds spaces and objects to behavior.

Examples:

* room semantic types
* object semantic bindings
* policy definitions such as focus zones and collaboration zones
* task-to-room suitability rules
* semantic validators for structural changes

### AgentHabitat.Simulation

Owns the canonical world simulation.

Responsibilities:

* grid-based movement and pathing
* deterministic ticks
* occupancy and presence
* room bounds and traversability
* structural world modifications
* world time and ambient schedules

Important architectural note: simulation remains grid-based internally, but exposed render projections should support interpolated movement so the world feels continuous.

### AgentHabitat.Orchestration

Owns agents, task assignment, workflows, progress, collaboration, and host coordination.

Responsibilities:

* task intake and lifecycle
* capability matching
* agent assignment
* workflow execution
* collaboration contexts
* external host dispatch
* activity patch processing

### AgentHabitat.Generation

Owns the generative asset foundry.

Responsibilities:

* asset intent ingestion
* provider selection
* generation request dispatch
* validation and scoring
* style enforcement
* approval flow
* artifact persistence integration

### AgentHabitat.Application

Owns use-case coordination across modules.

Responsibilities:

* command handling
* query handling
* transaction coordination
* approvals
* policy enforcement
* orchestration of simulation, orchestration, and generation services

This is the layer where most end-to-end use cases should live.

### AgentHabitat.Infrastructure

Owns persistence, messaging, provider adapters, external API clients, repository implementations, and file/blob storage concerns.

Responsibilities:

* EF Core or Dapper data access
* Redis caching and coordination
* object storage access
* external service SDK clients
* OpenTelemetry wiring
* auth integration infrastructure

### AgentHabitat.Api

Owns the HTTP and SignalR surface.

Responsibilities:

* REST or minimal APIs
* SignalR hubs
* auth and authorization enforcement
* session registration endpoints
* admin or inspection endpoints

### AgentHabitat.Client

Owns the user-facing application.

Responsibilities:

* world renderer
* presence visualization
* room and agent inspectors
* task panels
* collaboration views
* approvals UI
* world editing or expansion UI where permitted

### AgentHabitat.Mcp

Owns MCP-compatible exposure of habitat resources and tools.

Responsibilities:

* resource discovery
* tool definitions
* command adaptation
* session bridging for MCP clients

### AgentHabitat.Integrations.ExternalHosts

Owns adapters for external agent hosts.

Examples:

* Claude Code hook adapter
* Copilot-oriented adapter surface where supported
* generic webhook or plugin adapter
* session dispatch contracts

## Runtime Model

The system should be understood as two coordinated runtimes.

### 1. Habitat Runtime

This is the authoritative runtime.

It owns:

* world state
* agent identity and placement
* movement simulation
* task assignment state
* approvals and provenance
* structural world evolution

### 2. Agent Execution Runtime

This is where actual task reasoning may occur.

It may be:

* first-party Semantic Kernel execution
* an internal hosted agent runtime
* Claude Code
* Copilot or IDE-integrated host
* MCP-capable tool host

The key rule is that the execution runtime does not become the source of truth for the world. It performs work, reports state transitions, and consumes bounded context.

## Occupant Model

The world contains two first-class occupant types.

### Agent Occupants

Autonomous or semi-autonomous inhabitants that perform work and ambient behaviors.

### User Occupants

Human users represented directly in the habitat.

Both should share a common presence model for movement, room occupancy, and collaboration display, while differing in permissions and execution semantics.

```csharp
public enum OccupantKind
{
    User,
    Agent
}

public sealed record OccupantPresence(
    Guid OccupantId,
    OccupantKind OccupantKind,
    string DisplayName,
    RoomId CurrentRoomId,
    int GridX,
    int GridY,
    string Facing,
    string Activity,
    bool IsCollaborating);
```

## World Simulation Architecture

### Canonical Representation

The simulation uses a tile or grid model as canonical state.

Why:

* deterministic behavior
* easier pathfinding
* simpler structural editing
* reproducible simulation for tests and replay
* easier collision and occupancy semantics

### Render Projection

The render layer should interpolate between simulation states to create the illusion of continuous movement.

The simulation might move an occupant from `(10,5)` to `(11,5)`, but the client animates that transition smoothly.

### Simulation Tick Model

The simulation should advance through discrete ticks.

Suggested responsibilities per tick:

* process queued movement intents
* advance pathfinding steps
* process room entry and exit
* update ambient schedules
* evaluate policy triggers
* apply approved structural changes
* emit domain events or projection updates

### Pathing

Pathfinding should be deterministic and aware of:

* blocked tiles
* room bounds
* doors or passage points
* occupancy rules
* structural changes applied since last plan

## Structural Expansion Architecture

Structural expansion is a first-milestone feature, so the architecture must treat map changes as canonical operations rather than afterthoughts.

### Structural Operations

Examples:

* create room
* expand room
* add hallway or connector
* add doorway
* place structural object
* re-theme region
* alter furniture layout

### Structural Change Flow

1. A user or agent proposes a structural change.
2. The proposal is validated semantically and spatially.
3. Required approvals are evaluated.
4. The simulation applies the change transactionally.
5. Persistence stores the updated structure.
6. Projection streams notify clients.
7. Provenance records capture who proposed and approved the change.

### Structural Integrity Rules

The system must guard against invalid worlds.

Examples:

* rooms cannot overlap illegally
* all required traversal paths must remain valid
* region boundaries must remain coherent
* object placements must still fit inside modified bounds
* semantics of a room must remain valid after structural edits

## Work Orchestration Architecture

### Work Intake

Work enters the system through commands, integrations, or imported external tasks.

Examples:

* implement feature
* review pull request
* research API
* write spec
* fix bug
* decorate shared room
* build new workshop

### Task Assignment

Assignment logic considers:

* required capabilities
* agent availability
* current activity
* room suitability
* collaboration requirements
* trust or permission profile
* host capabilities for externally bound agents

### Collaboration

Collaboration is a true shared-work construct, not just visual co-location.

```csharp
public sealed record CollaborationContext(
    Guid CollaborationContextId,
    WorkItemId WorkItemId,
    string CollaborationKind,
    IReadOnlyCollection<AgentId> AgentIds,
    IReadOnlyCollection<UserId> UserIds,
    RoomId RoomId,
    string SharedActivity,
    decimal Progress);
```

A collaboration context may be projected visually through:

* multiple occupants around a shared desk
* multiple occupants at a review table
* whiteboard usage
* synchronized activity labels
* shared emotes or progress indicators

### Workflow Execution

Workflow execution should use typed steps rather than freeform state blobs.

Benefits:

* inspectable execution
* replayability
* easier testing
* better observability
* cleaner host integration

## External Host Integration Architecture

The architecture supports two integration paths.

### Direct Runtime Integration

Internal hosted agents use native interfaces and internal services.

Examples:

* Semantic Kernel-based agents
* local builder agents
* internal review agents

### External Host Integration

External tools can host agent execution through hooks, plugins, MCP, or web APIs.

Examples:

* Claude Code
* Copilot-compatible hosts
* IDE plugins
* generic webhook-driven executors

### External Session Model

Each external integration session is first-class.

```csharp
public sealed record ExternalAgentSession(
    Guid SessionId,
    string HostKind,
    string HostDisplayName,
    AgentId BoundAgentId,
    string IntegrationMode,
    DateTimeOffset ConnectedAt,
    DateTimeOffset? LastHeartbeatAt,
    IReadOnlyCollection<string> SupportedCapabilities,
    IReadOnlyCollection<string> GrantedScopes);
```

### Token-Minimized Operating Mode

Default mode should minimize ongoing context transfer.

When not explicitly in free-roam mode:

* the habitat simulates idle life locally
* the habitat handles visible movement transitions
* the host receives only compact assignment packets
* the host sends only meaningful activity patches or completion results

### Free-Roam Operating Mode

Only when explicitly enabled should the external host gain richer discretionary context about the world for ambient exploration, chatting, or building.

This prevents constant token consumption while preserving richer modes when desired.

### Assignment Packet Design

```csharp
public sealed record ExternalAssignmentPacket(
    Guid SessionId,
    WorkItemId WorkItemId,
    string AssignmentKind,
    string Summary,
    string TargetRoom,
    string ExpectedActivity,
    IReadOnlyCollection<string> ContextHandles,
    IReadOnlyCollection<string> Constraints,
    string CompletionContract);
```

### Activity Patch Design

```csharp
public sealed record ExternalActivityPatch(
    Guid SessionId,
    AgentId AgentId,
    string ActivityType,
    string? Message,
    decimal? Progress,
    string? RelatedWorkItemId,
    DateTimeOffset OccurredAt);
```

## Generation Architecture

The generation subsystem is fully pluggable.

### Design Rule

Generation providers can be local, remote, or hybrid, but governance remains central.

This means:

* generation providers are replaceable
* validation stays inside Agent Habitat
* style enforcement stays inside Agent Habitat
* approval and provenance stay inside Agent Habitat

### Generation Domains

* visual generation
* spatial generation
* narrative generation
* behavioral generation

### Generation Flow

1. Create structured intent.
2. Resolve provider strategy.
3. Dispatch generation request.
4. Receive candidates.
5. Validate candidates.
6. Optionally review.
7. Approve and persist.
8. Apply to world or artifact inventory.

### Provider Abstraction

```csharp
public interface IGenerationProvider
{
    string ProviderName { get; }
    Task<GenerationResult> GenerateAsync(GenerationRequest request, CancellationToken cancellationToken);
}
```

### Deterministic Generation

World generation should support deterministic seeds.

```csharp
public readonly record struct WorldSeed(string Value);

public sealed record WorldGenerationOptions(
    WorldSeed Seed,
    bool DeterministicMode,
    bool AllowStructuralExpansion,
    string ActiveStyleProfile);
```

This supports:

* reproducible environments
* test stability
* replay and debugging
* curated world variants

## Persistence Architecture

### Primary Stores

* PostgreSQL for canonical state
* Redis for transient presence, coordination, and hot cache concerns
* object storage for generated asset binaries and other payloads

### Canonical Relational Data

Suggested persistent areas:

* worlds
* regions
* rooms
* room layouts
* structural edges or connectors
* occupants
* work items
* collaboration contexts
* artifacts
* provenance records
* external sessions
* approvals

### Event Model

Use hybrid state plus events.

The database stores current canonical state for fast reads and simpler implementation. Important state transitions emit domain events for projections, audit, and observability.

Examples:

* AgentMoved
* UserEnteredRoom
* WorkItemAssigned
* CollaborationStarted
* CollaborationEnded
* AssetApproved
* RoomCreated
* RoomExpanded
* LayoutChanged
* ExternalAssignmentDispatched
* ExternalActivityReported

## Projection Architecture

The client should not render raw domain entities directly.

Instead, the system should maintain fit-for-purpose projections such as:

* world render projection
* room occupancy projection
* collaboration projection
* task board projection
* approvals projection
* artifact display projection

### Projection Update Sources

* simulation ticks
* orchestration transitions
* structural changes
* external activity patches
* generation approvals

### Delivery Mechanism

SignalR is the preferred mechanism for near-real-time updates in v1.

## API Architecture

### HTTP Surface

Use HTTP APIs for:

* command submission
* room and world inspection
* task inspection
* provenance inspection
* approvals
* asset retrieval metadata
* session registration

### SignalR Surface

Use SignalR for:

* movement and room occupancy updates
* collaboration updates
* activity changes
* world diffs
* structural changes
* ambient events

### MCP Surface

Expose habitat resources and tools for compatible agent clients.

Examples:

* `habitat://world/current`
* `habitat://rooms/{roomId}`
* `habitat://agents/{agentId}`
* `habitat://work-items/{workItemId}`
* `habitat://sessions/{sessionId}`

## Security and Trust Boundaries

### Core Trust Principle

The habitat owns truth. External hosts and providers are bounded participants.

### Boundaries

* users act through authenticated application sessions
* internal agents act through platform-managed capability sets
* external hosts act through registered sessions and granted scopes
* generation providers act through adapter boundaries
* external work tools act through explicit integration contracts

### Governance Requirements

* provenance for generated or structural changes
* approvals for sensitive changes
* explicit scopes for external sessions
* auditable activity patch history
* policy checks before external side effects

## Observability Architecture

Use OpenTelemetry everywhere practical.

### Metrics

* active occupants
* idle agents
* collaboration counts
* work completion rates
* review turnaround time
* structural changes per period
* external host dispatch success rate
* external host latency
* projection latency
* generation approval and rejection counts
* free-roam session counts versus token-minimized session counts

### Tracing

Trace end-to-end flows including:

* task intake
* assignment
* movement transition
* external dispatch
* activity updates
* collaboration start or end
* generation request and validation
* structural application
* projection broadcast

### Logging

Use structured logs with strong correlation IDs for:

* work items
* collaboration contexts
* generation proposals
* external sessions
* approval flows

## Deployment Topology

### Local Development

Use Aspire to compose:

* API
* client
* PostgreSQL
* Redis
* optional object storage emulator
* optional local generation providers

### Production Initial Topology

Start with a modular monolith deployment plus managed infrastructure.

Suggested shape:

* one app service or containerized service for API plus application runtime
* one client web deployment if split, or unified hosting if Blazor Web App
* managed PostgreSQL
* managed Redis
* object storage bucket or container

### Evolution Path

Potential future extractions if needed:

* generation worker service
* projection service
* simulation worker
* integration gateway for external hosts

Do not start there unless justified.

## Core Sequence Flows

### Sequence: Work Assignment to External Host

1. User submits a work item.
2. Orchestration selects an agent and identifies its bound host session.
3. Simulation schedules the visible transition from current location to target room.
4. Application layer dispatches a compact assignment packet.
5. Projection layer shows the occupant walking to the room.
6. External host performs the task.
7. Host reports activity patches.
8. Habitat updates activity state and world projection.
9. Completion transitions the agent back into next-state logic such as review, idle, or celebration.

### Sequence: Collaboration Flow

1. A work item requires multiple participants.
2. Orchestration creates a collaboration context.
3. Simulation routes participants to a shared collaboration space.
4. Projection shows co-working behavior.
5. Shared progress is updated through workflow or host activity patches.
6. Completion ends the collaboration context and may place resulting artifacts into the world.

### Sequence: Structural Expansion

1. User or agent proposes a new room or structural change.
2. Semantics validates suitability.
3. Simulation validates spatial integrity.
4. Approval policy decides whether review is needed.
5. Approved change is applied transactionally.
6. Persistence stores updated structure and provenance.
7. Projection notifies clients and updates traversability.

## Testing Strategy

### Architecture Tests

Verify allowed dependencies and module boundaries.

### Domain Tests

Verify rules, policies, invariants, and events.

### Simulation Tests

Verify deterministic movement, pathing, occupancy, and structural edits.

### Orchestration Tests

Verify assignment logic, collaboration formation, workflow progression, and host dispatch logic.

### Generation Tests

Verify provider selection, validation, style enforcement, and approval handling.

### API Tests

Verify commands, auth behavior, session registration, and projection delivery.

### End-to-End Scenarios

Examples:

* user enters world and collaborates with an agent
* agent receives coding task and moves from lounge to coding room
* two agents enter collaboration context and complete a review
* agent proposes room expansion and it is approved and rendered
* deterministic world generation produces repeatable layout

## Implementation Priorities

### Milestone 1

* modular monolith skeleton
* canonical domain model
* grid simulation with interpolated client rendering
* users and agents as first-class occupants
* core rooms and semantic bindings
* task intake and assignment
* collaboration contexts
* external host session model
* token-minimized assignment and activity patch flow
* structural expansion support
* deterministic seeded world creation
* SignalR world projection

### Milestone 2

* richer approvals and provenance
* pluggable generation providers
* generation validation pipeline
* ambient behaviors and social interactions
* artifact display systems
* stronger MCP surface

### Milestone 3

* richer world editing UX
* advanced district growth
* more sophisticated collaboration visualization
* optional module extraction based on operational evidence

## Final Notes

The architecture succeeds when Agent Habitat feels alive without sacrificing determinism, trust, inspectability, or developer ergonomics.

The world must be expressive, but it must also be rigorous. Grid-based simulation keeps the core stable. Smooth rendering keeps it beautiful. Typed workflows keep it understandable. External host integrations keep it flexible. Structural expansion and generative systems keep it alive.

That combination is the essence of the platform.
