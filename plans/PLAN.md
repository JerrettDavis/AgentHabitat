# Agent Habitat

## Executive Summary

Agent Habitat is a C#-first, persistent, generative sandbox where autonomous agents visibly live, work, collaborate, and evolve inside a simulated 2D world. The world is not a cosmetic shell pasted over an orchestration system. It is a spatial projection of actual agent state, task flow, memory, coordination, and growth.

Agents can perform meaningful software-oriented work such as planning, coding, code review, testing, documentation, and operations tasks. When idle or under low utilization, they can engage in lower-priority ambient behaviors such as decorating spaces, socializing, reorganizing shared rooms, reading from libraries, or contributing to world-building. The environment itself is generative and persistent. Rooms, props, decorations, cultural artifacts, and environmental changes emerge from agent behavior and workflow history rather than being exclusively hand-authored.

This document defines a C#-flavored system design intended to be handed to implementation agents as a blueprint for delivery.

## Product Vision

Build a spatial operating environment for autonomous work.

The system should make agent activity legible, intuitive, inspectable, and alive. Rather than reading job queues, traces, and logs in isolation, users should be able to glance at a world and understand what is happening. A coding room full of active agents, a review desk stacked with pull requests, a quiet library with a research-oriented agent reading docs, or a break area full of idle chatter should all communicate real system state through spatial metaphor.

At the same time, the environment should support persistent growth. Agents should accumulate history, preferences, relationships, specialties, and environmental influence. The world should remember what happened in it.

## Core Design Principles

### 1. The world is real, not decorative

World state must map to actual orchestration state. Room occupancy, interactions, object state, and environmental changes should correspond to meaningful runtime facts.

### 2. Persistent memory should become visible

Important work, milestones, failures, achievements, and habits should leave traces in the environment through decorations, artifacts, room changes, trophies, signage, and other persistent objects.

### 3. Agents should shape the world

Agents should not merely exist in the world. They should propose, generate, refine, and place environmental changes under policy and validation.

### 4. Strongly typed contracts over string soup

The platform should favor typed domain models, explicit messages, well-defined events, discriminated outcomes, and policy-enforced workflows.

### 5. Local-first, self-hostable, observable

The solution should be runnable locally, deployable in containers, suitable for Aspire-based composition, and fully instrumented.

### 6. Generative does not mean uncontrolled

All generative behavior must be constrained by style systems, world rules, validation, provenance, and moderation policies.

## Goals

The system should:

* Provide a persistent 2D virtual habitat for autonomous agents
* Allow agents to perform actual work and project that work into the world
* Support coding, code review, research, planning, testing, and documentation workflows
* Support generated environmental assets and world changes
* Preserve provenance for generated content and world modifications
* Offer real-time visualization of agent state and collaboration
* Expose world and work semantics through a clean API surface
* Be C#-first in architecture, implementation style, and developer ergonomics
* Be easy to run locally and compose in development environments

## Non-Goals

The initial version will not aim to:

* Build a full MMO-style multiplayer game engine
* Support unconstrained user-generated arbitrary runtime code execution inside the client
* Produce AAA quality art or animation pipelines on day one
* Replace professional project management or observability platforms outright
* Simulate human-like consciousness or unrestricted long-term self-directed evolution

## High-Level Conceptual Model

The platform consists of five major layers.

### 1. Simulation Layer

This layer owns the canonical world model.

Responsibilities:

* Maps, tiles, rooms, paths, zones
* World objects and item placement
* Avatars, movement, collision, animation state
* Environmental state and persistence
* Time-of-day, schedules, ambient simulation

### 2. Semantic Layer

This layer maps world constructs to meaning.

Responsibilities:

* Room semantics such as CodingRoom, ReviewRoom, Library, Lounge, BuildLab
* Object semantics such as Terminal, BacklogBoard, Mailbox, Bookshelf, TrophyCase
* Rule bindings between virtual objects and actual work entities
* Zone policies such as FocusZone or CollaborativeZone

### 3. Work Orchestration Layer

This layer owns actual autonomous work.

Responsibilities:

* Task planning and assignment
* Skill routing and capability matching
* Coding and review workflows
* External tool execution and repository actions
* Workflow capture and memory
* Agent scheduling and utilization

### 4. Protocol and Integration Layer

This layer exposes the world and accepts commands.

Responsibilities:

* HTTP and WebSocket APIs
* MCP-compatible surface where appropriate
* Event streams
* External integrations such as GitHub, file systems, issue trackers, CI systems
* AuthN and AuthZ
* Hook-based integration points for external agentic tools
* Low-token projection modes for ambient or background world synchronization

### Agentic Integration Strategy

The platform should support two complementary integration families.

#### 1. Direct Runtime Agents

These are first-party agents hosted and orchestrated directly inside the platform.

Examples:

* Semantic Kernel-based agents
* Internal planners and executors
* Hosted review or coding agents
* Background simulation or builder agents

These agents can use native contracts and internal services directly with minimal impedance.

#### 2. External Tool-Hosted Agents

These are agents operating through external platforms and products.

Examples:

* Claude Code
* GitHub Copilot and Copilot-adjacent tooling
* MCP-capable IDE agents
* Hook, skill, or plugin driven agent environments
* Future third-party agent shells that can consume MCP, hooks, plugins, or web APIs

These agents should not require deep bespoke integrations per provider where a standard surface can be used instead.

### Integration Design Principle

The habitat should treat external tools as agent hosts, not as the source of truth.

The source of truth remains inside Agent Habitat. External tools should connect through constrained, inspectable integration surfaces that allow them to:

* receive assignments
* report state changes
* claim or complete work
* synchronize high-level world activity
* trigger movement or room transitions
* read only the minimum context needed for the current task

This keeps token use low, maintains provenance, and prevents the world simulation from becoming dependent on any one external vendor surface.

### 5. Presentation Layer

This layer renders the habitat.

Responsibilities:

* Web-based 2D client
* Live world visualization
* Agent panels, overlays, world editing UX
* User interactions and inspection tools

## C# Technology Direction

### Recommended Runtime Stack

* .NET 10
* ASP.NET Core for APIs and streaming endpoints
* Aspire AppHost for local composition and developer experience
* Orleans or actor-like internal runtime patterns for world partitions and agent simulation boundaries if needed
* SignalR for real-time updates to the client
* PostgreSQL for durable relational persistence
* Redis for ephemeral caching, distributed coordination, and pub/sub where useful
* OpenTelemetry for tracing, logs, and metrics
* BackgroundService or durable workflow runner for scheduled simulation ticks and task progression

### Recommended Frontend Direction

Two viable options exist.

#### Option A: Blazor + Canvas/WebGL wrapper

* Keeps the app deeply C# flavored end to end
* Better for a .NET-centric ecosystem
* Can use a JS interop island for rendering where needed

#### Option B: Separate TypeScript client

* Faster access to mature game rendering ecosystems
* Better if the visual client becomes substantial

For initial implementation, prefer **Blazor Web App + a focused rendering layer** if the goal is strong C# alignment and faster full-stack cohesion.

## Solution Structure

```text
/src
  /AgentHabitat.AppHost
  /AgentHabitat.ServiceDefaults
  /AgentHabitat.Api
  /AgentHabitat.Client
  /AgentHabitat.Domain
  /AgentHabitat.Application
  /AgentHabitat.Infrastructure
  /AgentHabitat.Simulation
  /AgentHabitat.Semantics
  /AgentHabitat.Orchestration
  /AgentHabitat.Generation
  /AgentHabitat.Contracts
  /AgentHabitat.Integrations.GitHub
  /AgentHabitat.Integrations.FileSystem
  /AgentHabitat.Integrations.Issues
  /AgentHabitat.Mcp
/tests
  /AgentHabitat.Domain.Tests
  /AgentHabitat.Application.Tests
  /AgentHabitat.Simulation.Tests
  /AgentHabitat.Semantics.Tests
  /AgentHabitat.Orchestration.Tests
  /AgentHabitat.Generation.Tests
  /AgentHabitat.ArchitectureTests
/docs
  /adrs
  /architecture
  /plans
  /specs
```

## Architectural Style

Adopt a Clean Architecture or slice-friendly modular architecture with strong bounded modules rather than a giant anemic services bucket.

Recommended modules:

* World Simulation
* World Semantics
* Agent Runtime
* Task Orchestration
* Generation Foundry
* Social and Ambient Behaviors
* Persistence
* Real-Time Projection
* External Integrations

Each module should expose explicit contracts and events rather than sharing mutable implementation state casually.

## Domain Model

### Core Aggregates

#### World

Represents the persistent habitat.

Properties:

* WorldId
* Name
* Seed
* CurrentTime
* ClimateProfile
* ActiveStyleProfileId
* Version

#### Region

A large partition or district in the world.

Properties:

* RegionId
* WorldId
* Name
* Theme
* Bounds
* RegionType

#### Room

A semantically meaningful space where work or ambient behaviors occur.

Properties:

* RoomId
* RegionId
* Name
* RoomType
* Capacity
* PolicyProfileId
* Bounds
* CurrentMood

Examples:

* CodingRoom
* ReviewRoom
* PlanningRoom
* Library
* BreakRoom
* Garden
* Archive
* Workshop

#### WorldObject

A placeable object with visual, semantic, and interactive meaning.

Properties:

* ObjectId
* RoomId
* ObjectType
* Position
* Orientation
* VisualDefinitionId
* SemanticBinding
* InteractionProfileId
* PlacementMetadata
* ProvenanceRecordId

Examples:

* Terminal
* Desk
* Whiteboard
* TrophyCase
* Plant
* Bookshelf
* BuildMonitor
* PRInboxTray

#### AgentResident

Represents an agent as an inhabitant of the habitat.

Properties:

* AgentId
* DisplayName
* PersonaProfileId
* HomeRoomId
* CurrentLocation
* CurrentActivity
* Mood
* Energy
* Focus
* SkillProfileId
* Inventory
* RelationshipSummary
* AppearanceDefinitionId

#### WorkItem

A unit of actual work.

Properties:

* WorkItemId
* Kind
* Title
* Description
* Priority
* State
* AssignedAgentIds
* AssociatedWorldBindings
* ExternalReference
* RequiredCapabilities

Examples:

* ImplementFeature
* ReviewPullRequest
* WriteSpec
* InvestigateBug
* SummarizeDocs
* RefactorModule

#### Artifact

A persistent representation of work output or cultural/world output.

Properties:

* ArtifactId
* ArtifactType
* Title
* SourceWorkItemId
* FileReference
* DisplayPlacement
* ProvenanceRecordId

Examples:

* CodePatch
* ReviewNote
* Trophy
* Poster
* RoomBlueprint
* DecorativeAsset

#### ProvenanceRecord

Captures why and how something exists.

Properties:

* ProvenanceRecordId
* InitiatorType
* InitiatorId
* ReviewerId
* TriggerEvent
* SourcePromptOrIntent
* ValidatorsApplied
* CreatedAt
* ApprovedAt
* Notes

## World Semantics

Semantics bind spatial constructs to runtime meaning.

### Example Semantic Bindings

* A `CodingRoom` can accept implementation tasks and provide focus bonuses
* A `ReviewDesk` can display open pull requests bound to repository state
* A `Library` can surface document corpora and research context
* A `BreakRoom` can host ambient low-priority social interactions
* A `Workshop` can host construction and world-generation workflows
* A `TrophyCase` can display milestone artifacts from completed work

### Semantic Policies

Policies govern what can occur in a location.

Examples:

* `FocusZonePolicy`: discourages ambient chatter, increases concentration modifiers
* `CollaborationZonePolicy`: enables pair workflows and shared task contexts
* `ConstructionZonePolicy`: allows generated asset placement proposals
* `QuietHoursPolicy`: alters movement and ambient behavior during specified periods

## Agent Runtime Model

Each agent should have both work-facing and habitat-facing state.

### Work State

* Assigned tasks
* Active workflow step
* Tool access profile
* Current repository or context
* Confidence and escalation state
* Last execution outcome

### Habitat State

* Current room and coordinates
* Target destination
* Social state
* Mood or vibe profile
* Environmental preferences
* Decoration interests
* Energy and focus

### Example Activity Types

* Idle
* Walking
* Coding
* Reviewing
* Reading
* Planning
* Pairing
* Chatting
* Decorating
* Constructing
* Resting
* Celebrating

### Agent Behavior Priorities

1. Critical work and interrupts
2. Assigned work items
3. Maintenance work
4. Collaborative responses
5. Ambient behaviors
6. Optional self-improvement or world-improvement

## Task and Workflow Model

### Task Lifecycle

* Proposed
* Accepted
* Claimed
* InProgress
* Blocked
* AwaitingReview
* Completed
* Rejected
* Archived

### Workflow Composition

Each meaningful activity should be expressible as a structured workflow.

Examples:

* Implement feature workflow
* Review pull request workflow
* Investigate failing test workflow
* Generate and approve room decoration workflow
* Build new room workflow

### Suggested Workflow Engine Shape

Use explicit step types rather than giant prompt blobs.

```csharp
public abstract record WorkflowStep(WorkflowStepId Id, string Name);

public sealed record MoveToRoomStep(WorkflowStepId Id, RoomId RoomId) : WorkflowStep(Id, "Move To Room");
public sealed record ReadContextStep(WorkflowStepId Id, string ResourceKey) : WorkflowStep(Id, "Read Context");
public sealed record ExecuteToolStep(WorkflowStepId Id, string ToolName, IReadOnlyDictionary<string, object?> Arguments)
    : WorkflowStep(Id, "Execute Tool");
public sealed record GenerateAssetStep(WorkflowStepId Id, AssetIntent Intent)
    : WorkflowStep(Id, "Generate Asset");
public sealed record AwaitReviewStep(WorkflowStepId Id, AgentId ReviewerId)
    : WorkflowStep(Id, "Await Review");
```

This should allow workflows to be persisted, inspected, replayed, and evolved.

## Generative Asset Foundry

This subsystem should own all generated environmental assets and modifications.

### Responsibilities

* Convert structured intent into candidate assets
* Constrain outputs to style profiles and technical limits
* Validate placement, coherence, and quality
* Track provenance
* Version and cache approved assets

### Generation Domains

#### 1. Visual Generation

Produces:

* Sprite sheets
* Props
* Decorations
* Portraits
* Small animations
* Environmental variants

#### 2. Spatial Generation

Produces:

* Room layouts
* Furniture arrangements
* District expansion plans
* Pathing or placement suggestions

#### 3. Narrative Generation

Produces:

* Room names
* Notes, signs, journals, trophy text
* Cultural artifacts and world flavor

#### 4. Behavioral Generation

Produces:

* Ambient routines
* Decoration preferences
* Social tendencies
* Build priorities

### Asset Intent Contract

```csharp
public sealed record AssetIntent(
    string IntentType,
    string Theme,
    string Purpose,
    string StyleProfile,
    string RequestedBy,
    IReadOnlyCollection<string> Constraints,
    IReadOnlyCollection<string> Tags);
```

### Asset Validation Criteria

* Tile dimensions and grid alignment
* Transparent background correctness
* Palette bounds and style compliance
* Semantic match with requested purpose
* Collision footprint validity
* Animation frame consistency where applicable
* Duplicate detection
* Safety and moderation checks

### Asset Lifecycle

* Proposed
* Generated
* Validated
* Reviewed
* Approved
* Placed
* Retired
* Archived

## Persistence Model

### Recommended Storage Split

* PostgreSQL for canonical world, agent, work, provenance, and artifact metadata
* Object storage for generated assets and artifact payloads
* Redis for transient projections, presence, and hot caches

### Event Sourcing Considerations

A hybrid approach is recommended.

Use current-state tables for hot reads and pragmatic implementation speed. Emit domain events for important changes such as:

* AgentMoved
* TaskClaimed
* TaskCompleted
* RoomConstructed
* AssetApproved
* DecorationPlaced
* AgentRelationshipChanged
* CelebrationTriggered

These events can power projections, audit, metrics, and replay-friendly features without forcing the whole platform into an event-sourced purity spiral.

## Real-Time Model

### Transport

* SignalR hubs for client subscriptions
* Optional server-sent events for lightweight streams

### Projection Streams

* World state diffs
* Agent movement updates
* Room occupancy updates
* Work item state changes
* Artifact placements
* Ambient chat events
* Construction proposals and approvals

### Client Rendering Strategy

The client should consume a projection model rather than raw domain entities. Keep domain shape separate from render shape.

```csharp
public sealed record AgentRenderState(
    Guid AgentId,
    string DisplayName,
    string SpriteKey,
    string CurrentActivity,
    string RoomName,
    int X,
    int Y,
    string Facing,
    IReadOnlyCollection<string> Emotes);
```

## API Surface

### HTTP APIs

* Query world, rooms, agents, work items, artifacts
* Submit tasks
* Approve or reject construction proposals
* Inspect provenance
* Retrieve generation outputs
* Register external agent sessions
* Publish low-volume activity updates for agent hosts

### Real-Time APIs

* Subscribe to world updates
* Subscribe to room-level streams
* Observe agent activity
* Observe assignment and workflow transitions

### MCP Surface

If included, expose the habitat through structured resources and tools.

#### Example Resources

* `habitat://world/current`
* `habitat://rooms/{roomId}`
* `habitat://agents/{agentId}`
* `habitat://work-items/{workItemId}`
* `habitat://artifacts/{artifactId}`
* `habitat://sessions/{sessionId}`

#### Example Tools

* `move_agent`
* `assign_work_item`
* `start_pair_session`
* `generate_room_decoration`
* `propose_room_expansion`
* `approve_asset`
* `post_room_message`
* `inspect_provenance`
* `claim_assignment`
* `report_activity`
* `complete_assignment`

### Hook and Plugin Surface

The platform should define a lightweight host integration model for tools that do not want to reason continuously about the world.

#### Supported Interaction Modes

##### 1. Assignment Mode

An external agent host receives a structured assignment containing:

* task identity
* required capabilities
* current world role and location
* a compact activity transition instruction
* minimal relevant context handles

Example:
The host is told that agent `Rook` should transition from `IdleInLounge` to `WalkingToCodingRoom`, then begin `ImplementFeature` work against work item `WI-142`.

##### 2. Activity Patch Mode

The external host sends compact status patches rather than replaying full world state.

Examples:

* `StartedWork`
* `NeedsReview`
* `BlockedOnContext`
* `TakingBreak`
* `CompletedWork`
* `ReturningToIdle`

The habitat then projects those patches into the world simulation, movement, and visible activity.

##### 3. Free-Roam Mode

Only when explicitly requested should an external host receive richer world context and discretionary control for ambient navigation, socializing, decoration, or exploratory behaviors.

This mode should be opt-in and token-aware.

### Token Minimization Strategy

The system should be designed so that most integrations do not need to consume tokens continuously to keep avatars alive.

#### Default Behavior

When not explicitly in free-roam mode:

* the world simulation owns idle behaviors locally
* movement can be simulated deterministically by the habitat
* external agents receive only assignment-relevant context
* the host reports only meaningful state transitions or outcomes
* ambient chat and decoration are handled by local policies or low-cost internal agents if desired

#### Practical Implication

If Claude Code, Copilot, or another integrated tool is asked to do a coding task, the external host should not need a full prompt describing the whole world every turn. Instead:

* Agent Habitat records the assignment
* the world shows the avatar walking from its prior activity to the appropriate room
* the host gets a compact work packet
* the host reports progress and completion events
* the habitat updates the visible world accordingly

This keeps the world feeling alive without paying a constant token tax.

### External Agent Session Model

Represent external integrations as first-class sessions.

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

### External Assignment Contract

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

### External Activity Patch Contract

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

### Integration Abstractions

```csharp
public interface IExternalAgentHost
{
    string HostKind { get; }
    Task<ExternalAgentSession> RegisterAsync(RegisterExternalAgentSessionCommand command, CancellationToken cancellationToken);
    Task DispatchAssignmentAsync(ExternalAssignmentPacket packet, CancellationToken cancellationToken);
    Task PublishActivityAsync(ExternalActivityPatch patch, CancellationToken cancellationToken);
}

public interface IHookAdapter
{
    string AdapterName { get; }
    Task<bool> CanHandleAsync(string hostKind, CancellationToken cancellationToken);
    Task<HookDispatchResult> DispatchAsync(HookDispatchRequest request, CancellationToken cancellationToken);
}
```

### Examples of Host Integrations

* Semantic Kernel direct adapters for first-party hosted agents
* MCP server integration for general-purpose agent clients
* Claude Code hook adapters that map assignments and state patches into its local workflow model
* Copilot-compatible adapters where available through supported extension or plugin mechanisms
* IDE-facing plugin surfaces that can show task state and emit completion patches back to the habitat

The architecture should not assume equal capabilities across all hosts. Instead, each integration advertises a capability profile and the habitat degrades gracefully.

## Security and Governance

This system becomes much more valuable when it remains trustworthy.

### Requirements

* Explicit tool access profiles per agent
* Policy gating for world modifications
* Approval workflows for significant generated assets and room changes
* Provenance for every generated or placed object
* Audit logs for task actions, reviews, and construction activities
* Isolation boundaries for external repository actions
* Safe prompt and tool envelope design

### Governance Tiers

* Ambient decorations may be auto-approved under safe constraints
* Shared-room changes may require peer or policy review
* Structural changes may require explicit human or high-trust agent approval
* External side effects should always remain governed by permissioned workflows

## Observability

Use OpenTelemetry across API, orchestration, generation, simulation, and host integration boundaries.

### Key Metrics

* Active agents
* Idle agents
* Work completion rates
* Review turnaround time
* Asset proposal volume
* Asset approval and rejection rates
* Room occupancy by type
* Ambient-to-productive time ratios
* Construction frequency
* Projection latency
* external host latency
* assignment dispatch success rate
* activity patch frequency
* token-minimized versus free-roam session counts

### Tracing

Trace workflows end to end:

* task intake
* assignment
* movement into room
* context acquisition
* tool execution
* review
* completion
* environmental side effects
* external host dispatch and callback handling

## Style System

The world should remain coherent even when generated.

### Style Profiles

A style profile defines:

* palette family
* tile scale
* environmental motif
* object grammar
* naming style
* animation style
* cultural flavor

Examples:

* Cozy Retro Office
* Tiny Cyber Lab
* Woodland Village of Builders
* Archive Dungeon
* Software Temple

### Style Enforcement

Generated outputs should target a named style profile. Rooms and regions may inherit or override style. Agents may have personal taste within constrained bounds.

## Progression and Evolution

Agents should evolve in ways that are visible.

### Possible Progression Vectors

* skill specialization
* trusted reviewer status
* favorite workspaces
* collaborative relationships
* aesthetic taste
* civic contribution score
* artifact legacy

### Environmental Manifestations

* expanded rooms
* improved desk setups
* personal collections
* trophies
* named corners or landmarks
* shared monuments for major achievements

## Recommended Implementation Phases

## Phase 1: Minimum Lovable Habitat

Deliver a working persistent world with actual work projection.

Scope:

* simple 2D map
* rooms and avatars
* agent movement
* work item assignment and state projection
* coding room, review room, break room, library
* SignalR live updates
* PostgreSQL persistence
* simple Blazor client
* manually curated starter assets

Success criteria:

* a user can submit work and watch agents visibly perform and complete it
* world state persists across restarts
* room occupancy and agent activity reflect real state changes

## Phase 2: World Semantics and Ambient Life

Make the world feel inhabited.

Scope:

* semantic objects
* ambient behaviors
* social interactions
* room policies
* artifact display
* provenance and audit trails
* more robust workflow engine

Success criteria:

* idle agents visibly engage in lower-priority world behaviors
* important work leaves visible traces in the world
* users can inspect why objects or changes exist

## Phase 3: Generative Foundry

Let the world build itself safely.

Scope:

* asset intent pipeline
* visual generation adapters
* validators and approval flow
* agent-driven decoration proposals
* generated room variants
* style profiles

Success criteria:

* agents can propose and place approved generated assets
* generated outputs remain stylistically coherent
* provenance is complete and queryable

## Phase 4: Structural Growth

Allow expansion and cultural evolution.

Scope:

* room construction workflows
* district generation
* major environmental changes
* shared cultural artifacts
* collaborative building

Success criteria:

* the world changes materially in response to long-term activity
* regions and rooms reflect accumulated project history

## Sample C# Contracts

```csharp
public readonly record struct AgentId(Guid Value);
public readonly record struct RoomId(Guid Value);
public readonly record struct WorkItemId(Guid Value);
public readonly record struct ArtifactId(Guid Value);

public enum AgentActivityType
{
    Idle,
    Walking,
    Coding,
    Reviewing,
    Reading,
    Planning,
    Pairing,
    Chatting,
    Decorating,
    Constructing,
    Resting,
    Celebrating
}

public enum WorkItemState
{
    Proposed,
    Accepted,
    Claimed,
    InProgress,
    Blocked,
    AwaitingReview,
    Completed,
    Rejected,
    Archived
}

public sealed record AgentResident(
    AgentId Id,
    string DisplayName,
    RoomId HomeRoomId,
    AgentActivityType CurrentActivity,
    decimal Energy,
    decimal Focus,
    string SkillProfile,
    string AppearanceKey);

public sealed record WorkItem(
    WorkItemId Id,
    string Kind,
    string Title,
    string Description,
    WorkItemState State,
    IReadOnlyCollection<AgentId> AssignedAgents,
    IReadOnlyCollection<string> RequiredCapabilities);

public interface IWorldSimulationService
{
    Task TickAsync(CancellationToken cancellationToken);
    Task MoveAgentAsync(AgentId agentId, RoomId destinationRoomId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<AgentResident>> GetAgentsAsync(CancellationToken cancellationToken);
}

public interface IWorkOrchestrator
{
    Task<WorkItemId> SubmitAsync(SubmitWorkItemCommand command, CancellationToken cancellationToken);
    Task AssignAsync(WorkItemId workItemId, AgentId agentId, CancellationToken cancellationToken);
    Task CompleteAsync(WorkItemId workItemId, CancellationToken cancellationToken);
}

public interface IAssetFoundry
{
    Task<AssetProposal> ProposeAsync(AssetIntent intent, CancellationToken cancellationToken);
    Task<AssetValidationResult> ValidateAsync(AssetProposal proposal, CancellationToken cancellationToken);
    Task<ApprovedAsset> ApproveAsync(AssetProposal proposal, CancellationToken cancellationToken);
}
```

## Acceptance Criteria for Initial Delivery

### World and Simulation

* The system shall persist a world containing regions, rooms, objects, and agents
* The system shall allow agents to move between rooms and update activity state
* The system shall stream world updates to connected clients in near real time

### Work Projection

* The system shall accept work items and assign them to agents
* The system shall bind active work to room occupancy and agent activity
* The system shall display completed work outcomes in the world or associated panels

### Ambient Behavior

* The system shall support idle behaviors that do not conflict with higher-priority work
* The system shall permit ambient chat and environmental interactions

### Governance

* The system shall record provenance for generated or placed assets
* The system shall support approval gates for shared-world modifications

### Extensibility

* The system shall define interfaces for integrating new generators, semantic object types, and work providers
* The system shall isolate domain logic from render-specific concerns

## Suggested ADRs

* ADR-001: Modular Monolith First
* ADR-002: Blazor Client with Render Abstraction
* ADR-003: PostgreSQL + Redis + Object Storage Persistence Split
* ADR-004: SignalR for Live Projection Updates
* ADR-005: Hybrid State Tables with Domain Events
* ADR-006: Asset Foundry with Validation and Approval Pipeline
* ADR-007: Strongly Typed Workflow Steps over Freeform Prompt Chains
* ADR-008: Provenance Required for All Generated World Changes
* ADR-009: External Agent Hosts as First-Class Sessions
* ADR-010: Token-Minimized Ambient Simulation by Default
* ADR-011: MCP Plus Hook Adapters for Cross-Platform Agentic Integration

## Resolved Design Decisions

### Movement Model

Agent movement in v1 shall be grid-based at the simulation and pathing level, with interpolated rendering and animation so movement feels continuous to users.

Implications:

* simulation logic can remain deterministic and simpler to reason about
* pathfinding, collision, placement, and replay all become more manageable
* the presentation layer should animate movement smoothly between grid cells
* the visual experience should feel alive even though the canonical movement model is tile-oriented

### Collaboration Representation

Pair-programming and broader collaboration shall be represented as a richer shared-work context, not merely co-location.

Implications:

* co-location remains part of the visual language
* collaborative work items can be bound to multiple agents simultaneously
* the world should visibly show multiple agents working together when collaborating
* collaboration zones, shared desks, review tables, whiteboards, or pairing stations can represent shared activity
* workflow and projection models must support multi-agent task participation and shared progress

### Generation Pipeline Hosting

The generation pipeline shall be entirely pluggable.

Implications:

* asset generation, narrative generation, and spatial generation can run locally or through external providers
* the core platform depends on provider abstractions rather than a single generation backend
* deployments can choose fully local, fully remote, or hybrid generation strategies
* governance, validation, provenance, and approval remain inside Agent Habitat regardless of provider location

### User Presence

User presence in the world shall be first-class in v1.

Implications:

* users can appear in the habitat as actual inhabitants rather than only as out-of-band administrators
* the world model should represent user avatars, location, status, and interactions
* rooms and collaboration flows should account for human-plus-agent interaction patterns from day one
* permissions and presence policies must distinguish between user capabilities and agent capabilities

### Deterministic World Seeds

World generation shall support deterministic seeds for replayable and reproducible environments.

Implications:

* seeded world creation should yield stable base layouts and deterministic generation where desired
* replay and debugging scenarios become easier to reason about
* tests can validate against reproducible world setups
* controlled procedural variation remains possible by changing seeds or scoped generation inputs

### Structural Expansion in the First Milestone

The initial milestone shall support structural expansion from day one rather than limiting generation to decorative changes only.

Implications:

* agents can build and reshape the world early
* room creation, expansion, and environmental growth are core product behaviors, not deferred stretch goals
* the simulation, persistence, semantics, and approval pipelines must all support map-changing operations in the first milestone
* the world should feel expressive, beautiful, and alive as a foundational experience rather than a later enhancement

## Updated Acceptance Criteria and Requirements

### Movement and Rendering

* The system shall use tile-oriented or grid-based simulation movement in v1
* The client shall render movement with interpolation and animation so movement feels continuous
* The system shall maintain deterministic pathing and collision behavior suitable for replay and debugging

### Collaboration

* The system shall support work items assigned to multiple agents
* The system shall visually represent collaborative work as shared activity rather than merely nearby avatars
* The system shall provide semantic collaboration spaces such as pairing desks, review tables, or shared workstations

### Pluggable Generation

* The system shall define provider abstractions for visual, spatial, narrative, and behavioral generation
* The system shall allow deployments to select local, remote, or hybrid generation backends without changing domain logic
* The system shall keep validation, governance, provenance, and approval centralized regardless of provider choice

### User Presence

* The system shall represent users as first-class inhabitants in the world model
* The system shall support user movement, interaction, and room presence in v1
* The system shall distinguish between user and agent permissions, policies, and capabilities

### Determinism

* The system shall support deterministic world seeding for reproducible environments
* The system shall allow simulation and generation features to opt into deterministic execution where appropriate

### Structural Expansion

* The system shall support room creation, structural modification, and world expansion in the first milestone
* The system shall allow approved agent-driven construction workflows to alter the map itself
* The system shall persist structural changes as canonical world state

## Additional Recommended Contracts

```csharp
public readonly record struct UserId(Guid Value);
public readonly record struct WorldSeed(string Value);

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

public sealed record CollaborationContext(
    Guid CollaborationContextId,
    WorkItemId WorkItemId,
    string CollaborationKind,
    IReadOnlyCollection<AgentId> AgentIds,
    IReadOnlyCollection<UserId> UserIds,
    RoomId RoomId,
    string SharedActivity,
    decimal Progress);

public sealed record WorldGenerationOptions(
    WorldSeed Seed,
    bool DeterministicMode,
    bool AllowStructuralExpansion,
    string ActiveStyleProfile);

public interface IGenerationProvider
{
    string ProviderName { get; }
    Task<GenerationResult> GenerateAsync(GenerationRequest request, CancellationToken cancellationToken);
}

public interface IStructureExpansionService
{
    Task<RoomId> CreateRoomAsync(CreateRoomCommand command, CancellationToken cancellationToken);
    Task ExpandRoomAsync(ExpandRoomCommand command, CancellationToken cancellationToken);
    Task ApplyLayoutChangeAsync(ApplyLayoutChangeCommand command, CancellationToken cancellationToken);
}
```

## Updated Suggested ADRs

* ADR-001: Modular Monolith First
* ADR-002: Blazor Client with Render Abstraction
* ADR-003: PostgreSQL + Redis + Object Storage Persistence Split
* ADR-004: SignalR for Live Projection Updates
* ADR-005: Hybrid State Tables with Domain Events
* ADR-006: Asset Foundry with Validation and Approval Pipeline
* ADR-007: Strongly Typed Workflow Steps over Freeform Prompt Chains
* ADR-008: Provenance Required for All Generated World Changes
* ADR-009: External Agent Hosts as First-Class Sessions
* ADR-010: Token-Minimized Ambient Simulation by Default
* ADR-011: MCP Plus Hook Adapters for Cross-Platform Agentic Integration
* ADR-012: Grid Simulation with Interpolated Continuous Rendering
* ADR-013: Collaboration as Shared Work Context
* ADR-014: First-Class User Presence in the Habitat
* ADR-015: Deterministic Seeded World Generation
* ADR-016: Structural Expansion in Milestone One

## Final Framing

Agent Habitat should be built as a persistent generative habitat for autonomous agents, where environment, culture, memory, and identity co-evolve with useful work.

The success condition is not merely that the world looks cute. It is that the world becomes a legible, trustworthy, and compelling operating surface for autonomous systems.

## Immediate Spec Track (POC-first)

To keep execution tight, the first implementation gate is now explicitly documented in:

- `plans/POC-01-2D-WORLD-GENERATION.md`
- `plans/SPEC-BACKLOG.md`

These define the first-priority deliverables, behaviors, use-cases, acceptance criteria, and pre-POC-to-POC sequencing for proving world generation quality and determinism.
