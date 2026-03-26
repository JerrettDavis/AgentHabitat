# DOMAIN-MODEL.md

## Overview

Agent Habitat models a persistent, generative, semantically meaningful 2D world inhabited by human users and autonomous agents. The domain model must support deterministic simulation, structural world growth, collaboration, real work orchestration, provenance, and pluggable generation without collapsing into a loose collection of DTOs and stringly typed state.

This document defines the core aggregates, entities, value objects, enums, relationships, invariants, and domain events that form the canonical business model of the system.

## Modeling Principles

### Strong typing first

Identifiers, states, semantic kinds, and lifecycle transitions should be modeled explicitly rather than as freeform strings wherever practical.

### World state is canonical

The domain model represents the true state of the habitat. Render models, transport payloads, SignalR messages, and MCP resources are projections derived from this model.

### Behavior belongs with the model

Important invariants and transitions should live in domain behaviors and policies, not only in controllers or orchestration glue.

### Provenance is part of the domain

Generated assets, structural modifications, and significant world changes are not side notes. They are first-class business facts and should be represented accordingly.

### Collaboration is real

Collaboration is not merely positional coincidence. The domain must support shared work contexts involving multiple occupants.

### Determinism matters

Where the world depends on seeded or replayable generation, those concepts must be reflected in the model.

## Bounded Domain Areas

The domain naturally separates into the following conceptual areas:

* World topology and structure
* Occupants and presence
* Work and workflows
* Collaboration
* Semantic meaning and policies
* Generation and artifacts
* Governance and provenance
* External host sessions

These areas may live in one domain assembly initially, but should remain conceptually distinct.

## Core Aggregates

### World

The root aggregate for a persistent habitat.

Responsibilities:

* owns overall world identity and deterministic seed
* defines world-level style and generation options
* contains or references regions
* enforces world-wide structural and simulation policies

Suggested shape:

```csharp
public sealed class World
{
    public WorldId Id { get; private set; }
    public string Name { get; private set; }
    public WorldSeed Seed { get; private set; }
    public StyleProfileId ActiveStyleProfileId { get; private set; }
    public WorldClock Clock { get; private set; }
    public WorldGenerationMode GenerationMode { get; private set; }
    public bool AllowStructuralExpansion { get; private set; }
    public int Version { get; private set; }

    private readonly List<Region> _regions = new();
    public IReadOnlyCollection<Region> Regions => _regions;
}
```

Invariants:

* a world must have a non-empty name
* a world must have a deterministic seed
* style profile must be defined
* structural expansion flags must be explicit

### Region

A major partition of a world, such as a district or biome.

Responsibilities:

* groups rooms and structural elements
* expresses regional themes or visual motifs
* constrains structural growth to a defined area

Suggested properties:

* RegionId
* WorldId
* Name
* RegionType
* ThemeKey
* Bounds
* LayoutVersion

Invariants:

* region bounds must be valid
* rooms within a region must fall within region bounds unless explicitly permitted otherwise

### Room

A semantically meaningful inhabitable space.

Responsibilities:

* defines a bounded area with a specific purpose
* hosts occupants, objects, and interactions
* enforces room-specific policies and capacity rules

Suggested shape:

```csharp
public sealed class Room
{
    public RoomId Id { get; private set; }
    public RegionId RegionId { get; private set; }
    public string Name { get; private set; }
    public RoomKind Kind { get; private set; }
    public GridRectangle Bounds { get; private set; }
    public CapacityLimit Capacity { get; private set; }
    public PolicyProfileId PolicyProfileId { get; private set; }
    public MoodState Mood { get; private set; }
    public int LayoutVersion { get; private set; }

    private readonly List<WorldObject> _objects = new();
    public IReadOnlyCollection<WorldObject> Objects => _objects;
}
```

Examples of `RoomKind`:

* CodingRoom
* ReviewRoom
* PlanningRoom
* BreakRoom
* Library
* Workshop
* Garden
* Archive
* Hallway
* Plaza

Invariants:

* room bounds must be non-zero and valid
* room kind must be defined
* room capacity must be positive
* objects must fit within room bounds

### CollaborationContext

An aggregate representing shared work across multiple occupants.

Responsibilities:

* binds one work item to multiple participants
* tracks collaboration state and shared progress
* binds collaboration to a room or collaboration zone

Suggested shape:

```csharp
public sealed class CollaborationContext
{
    public CollaborationContextId Id { get; private set; }
    public WorkItemId WorkItemId { get; private set; }
    public CollaborationKind Kind { get; private set; }
    public RoomId RoomId { get; private set; }
    public CollaborationState State { get; private set; }
    public ProgressValue Progress { get; private set; }

    private readonly List<AgentId> _agentIds = new();
    private readonly List<UserId> _userIds = new();

    public IReadOnlyCollection<AgentId> AgentIds => _agentIds;
    public IReadOnlyCollection<UserId> UserIds => _userIds;
}
```

Examples of `CollaborationKind`:

* PairProgramming
* GroupReview
* PlanningSession
* ResearchSession
* BuildSession
* SocialConversation

Invariants:

* collaboration must involve at least two participants total
* collaboration must bind to an existing work item or explicitly declared ambient shared activity
* room must be suitable for collaboration kind

### WorkItem

The aggregate representing a meaningful unit of work.

Responsibilities:

* captures actual tasks performed by agents or users
* tracks lifecycle, assignment, capability requirements, and outputs
* serves as the anchor for workflow execution and collaboration

Suggested shape:

```csharp
public sealed class WorkItem
{
    public WorkItemId Id { get; private set; }
    public WorkItemKind Kind { get; private set; }
    public string Title { get; private set; }
    public string Description { get; private set; }
    public WorkPriority Priority { get; private set; }
    public WorkItemState State { get; private set; }
    public ExternalReference? ExternalReference { get; private set; }
    public CapabilityProfile RequiredCapabilities { get; private set; }
    public RoomAffinity? PreferredRoomAffinity { get; private set; }

    private readonly List<AgentId> _assignedAgents = new();
    public IReadOnlyCollection<AgentId> AssignedAgents => _assignedAgents;
}
```

Examples of `WorkItemKind`:

* ImplementFeature
* ReviewPullRequest
* InvestigateBug
* WriteSpec
* SummarizeDocs
* BuildRoom
* DecorateRoom
* ResearchTopic

Invariants:

* title is required
* kind is required
* state transitions must be valid
* assigned agents must satisfy capabilities or trigger explicit override policy

### Artifact

An aggregate representing a durable output of work or world generation.

Responsibilities:

* represents produced or approved outputs
* binds outputs to work, rooms, provenance, and display placement
* supports world-visible cultural memory

Suggested properties:

* ArtifactId
* ArtifactKind
* Title
* SourceWorkItemId
* FileReference
* DisplayPlacement
* ProvenanceRecordId
* Visibility

Examples of `ArtifactKind`:

* CodePatch
* ReviewNote
* Poster
* Trophy
* JournalEntry
* DecorativeAsset
* Blueprint
* Monument

Invariants:

* artifact must have a known kind
* artifact must be traceable to a source or reason for existence

### ProvenanceRecord

An aggregate recording why something exists and how it came to be.

Responsibilities:

* records initiation, validation, approval, and application history
* supports trust, governance, and reversibility

Suggested shape:

```csharp
public sealed class ProvenanceRecord
{
    public ProvenanceRecordId Id { get; private set; }
    public InitiatorKind InitiatorKind { get; private set; }
    public Guid InitiatorId { get; private set; }
    public TriggerReason TriggerReason { get; private set; }
    public string IntentSummary { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? ApprovedAt { get; private set; }
    public ReviewerIdentity? Reviewer { get; private set; }

    private readonly List<ValidationResultRecord> _validations = new();
    public IReadOnlyCollection<ValidationResultRecord> Validations => _validations;
}
```

Invariants:

* provenance must identify an initiator
* provenance must identify a trigger reason
* approval metadata must be present when approval is required and granted

### ExternalAgentSession

An aggregate representing a bound relationship between an in-world agent and an external host.

Responsibilities:

* tracks connected host capabilities and granted scopes
* enables assignment dispatch and activity patch ingestion
* defines a trust boundary around external execution

Suggested properties:

* ExternalAgentSessionId
* AgentId
* HostKind
* HostDisplayName
* IntegrationMode
* GrantedScopes
* SupportedCapabilities
* ConnectionState
* ConnectedAt
* LastHeartbeatAt

Invariants:

* each active session must bind to exactly one agent
* granted scopes must be explicit
* disconnected sessions cannot receive new assignments without policy allowance

## Core Entities

### WorldObject

A placeable object within a room or region.

Responsibilities:

* represents interactive or decorative world items
* binds visuals, semantics, placement, and provenance

Suggested properties:

* WorldObjectId
* RoomId
* ObjectKind
* GridPosition
* Orientation
* VisualDefinitionId
* SemanticBinding
* InteractionProfileId
* CollisionFootprint
* ProvenanceRecordId

Examples of `ObjectKind`:

* Desk
* Terminal
* Whiteboard
* Bookshelf
* Plant
* TrophyCase
* ReviewTable
* Door
* Window
* Rug
* Mailbox

Invariants:

* object placement must fit valid traversable structure
* collision footprint must not overlap illegal occupied tiles

### OccupantPresence

An entity representing where a user or agent is and what they are doing.

Suggested shape:

```csharp
public sealed record OccupantPresence(
    OccupantId OccupantId,
    OccupantKind OccupantKind,
    string DisplayName,
    RoomId CurrentRoomId,
    GridPoint Location,
    FacingDirection Facing,
    ActivityState Activity,
    bool IsCollaborating);
```

Invariants:

* occupant must be in a valid room
* grid position must fall inside allowed walkable bounds

### AgentResident

Represents an autonomous inhabitant.

Responsibilities:

* holds identity, preferences, skills, and ambient world-facing traits
* participates in work and world life

Suggested properties:

* AgentId
* DisplayName
* PersonaProfileId
* HomeRoomId
* SkillProfileId
* AppearanceDefinitionId
* EnergyLevel
* FocusLevel
* SocialProfile
* DecorationPreferences
* TrustTier

### UserResident

Represents a human user in the habitat.

Responsibilities:

* models first-class user presence and collaboration
* separates human identity and permission concerns from agent autonomy

Suggested properties:

* UserId
* DisplayName
* AvatarDefinitionId
* PresenceState
* RoleMemberships
* PermissionProfileId

### WorkflowInstance

Represents an executing or persisted workflow.

Responsibilities:

* coordinates typed workflow steps tied to a work item or world operation
* enables replay, inspection, and policy-aware progression

Suggested properties:

* WorkflowInstanceId
* WorkflowKind
* SubjectId
* CurrentStepIndex
* Status
* StartedAt
* CompletedAt
* StepSnapshots

## Value Objects

### WorldId, RegionId, RoomId, AgentId, UserId, WorkItemId

Strongly typed identifiers.

```csharp
public readonly record struct WorldId(Guid Value);
public readonly record struct RegionId(Guid Value);
public readonly record struct RoomId(Guid Value);
public readonly record struct AgentId(Guid Value);
public readonly record struct UserId(Guid Value);
public readonly record struct WorkItemId(Guid Value);
```

### WorldSeed

Encapsulates deterministic world generation input.

```csharp
public readonly record struct WorldSeed(string Value);
```

Invariant:

* value cannot be null or whitespace

### GridPoint

Represents a tile coordinate.

```csharp
public readonly record struct GridPoint(int X, int Y);
```

### GridRectangle

Represents room or region bounds.

```csharp
public readonly record struct GridRectangle(int X, int Y, int Width, int Height);
```

Invariants:

* width and height must be positive

### CapacityLimit

Encapsulates room occupancy constraints.

```csharp
public readonly record struct CapacityLimit(int Value);
```

Invariant:

* value must be greater than zero

### ProgressValue

Represents normalized completion.

```csharp
public readonly record struct ProgressValue(decimal Value);
```

Invariant:

* value must be between 0 and 1 inclusive

### CapabilityProfile

Represents required or available capabilities.

Possible design:

* collection of capability tokens
* weighted proficiencies
* compatibility matching helper methods

### ExternalReference

Represents a link to an outside system such as GitHub, ADO, local repo path, or issue tracker.

## Enums and Closed State Models

### OccupantKind

```csharp
public enum OccupantKind
{
    User,
    Agent
}
```

### RoomKind

```csharp
public enum RoomKind
{
    CodingRoom,
    ReviewRoom,
    PlanningRoom,
    BreakRoom,
    Library,
    Workshop,
    Garden,
    Archive,
    Hallway,
    Plaza
}
```

### WorkItemState

```csharp
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
```

### AgentActivityType

```csharp
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
```

### CollaborationState

```csharp
public enum CollaborationState
{
    Proposed,
    Forming,
    Active,
    Paused,
    Completed,
    Cancelled
}
```

### CollaborationKind

```csharp
public enum CollaborationKind
{
    PairProgramming,
    GroupReview,
    PlanningSession,
    ResearchSession,
    BuildSession,
    SocialConversation
}
```

### ConnectionState

```csharp
public enum ConnectionState
{
    Connected,
    Degraded,
    Disconnected,
    Revoked
}
```

### ArtifactKind

```csharp
public enum ArtifactKind
{
    CodePatch,
    ReviewNote,
    Poster,
    Trophy,
    JournalEntry,
    DecorativeAsset,
    Blueprint,
    Monument
}
```

### InitiatorKind

```csharp
public enum InitiatorKind
{
    User,
    Agent,
    System,
    ExternalHost
}
```

## Relationships

### World to Region

* one world has many regions
* a region belongs to exactly one world

### Region to Room

* one region has many rooms
* a room belongs to exactly one region

### Room to WorldObject

* one room contains many objects
* a world object belongs to one room at a time

### Room to OccupantPresence

* one room may contain many occupants
* an occupant is present in exactly one room at a time unless disconnected from the world

### WorkItem to CollaborationContext

* one work item may have zero or one active collaboration context at a time in v1
* historical collaboration contexts may be many over time

### WorkItem to Artifact

* one work item may produce many artifacts

### Artifact to ProvenanceRecord

* every artifact must have one provenance record

### WorldObject to ProvenanceRecord

* generated or placed objects requiring traceability must have one provenance record

### AgentResident to ExternalAgentSession

* an agent may have zero or one active external session in v1
* historical sessions may be many

## Domain Policies

### Room Suitability Policy

Determines whether a work item or collaboration kind is appropriate for a room kind.

Examples:

* coding work prefers coding rooms or workshops
* review work prefers review rooms
* research work prefers libraries or archives
* pair programming requires a collaboration-supporting room policy

### Capacity Policy

Determines whether additional occupants or collaboration groups may enter a room.

### Structural Integrity Policy

Determines whether a structural change is valid.

Examples:

* prevents overlapping rooms
* preserves traversable paths
* ensures objects remain valid after layout changes

### Assignment Policy

Determines whether an agent can be assigned to a work item.

Inputs may include:

* required capabilities
* current trust tier
* host availability
* room affinity
* collaboration obligations

### Approval Policy

Determines whether a generated asset, structural change, or world modification requires review.

### Presence Transition Policy

Determines valid activity and movement transitions.

Examples:

* an occupant cannot teleport across disconnected rooms unless explicitly allowed by system rules
* an agent moving into collaboration should have a matching collaboration context or pre-join state

## Aggregate Invariants Summary

### World

* has valid seed
* has explicit style profile
* supports explicit generation mode settings

### Region

* bounds valid
* belongs to world

### Room

* valid bounds
* valid kind
* positive capacity
* objects must fit

### WorkItem

* valid lifecycle transitions
* required capabilities defined
* title non-empty

### CollaborationContext

* at least two participants
* valid room
* valid shared state transitions

### Artifact

* valid kind
* source or purpose traceable

### ProvenanceRecord

* initiator known
* trigger known
* approvals recorded when required

### ExternalAgentSession

* bound to exactly one agent
* scopes explicit
* disconnected sessions constrained

## Domain Events

### World and Structure Events

* WorldCreated
* RegionCreated
* RoomCreated
* RoomExpanded
* RoomRenamed
* StructuralLayoutChanged
* WorldObjectPlaced
* WorldObjectRemoved

### Presence Events

* OccupantEnteredRoom
* OccupantLeftRoom
* OccupantMoved
* ActivityChanged
* CollaborationJoined
* CollaborationLeft

### Work Events

* WorkItemSubmitted
* WorkItemAccepted
* WorkItemClaimed
* WorkItemAssigned
* WorkItemBlocked
* WorkItemCompleted
* WorkItemRejected

### Collaboration Events

* CollaborationStarted
* CollaborationPaused
* CollaborationResumed
* CollaborationCompleted
* CollaborationCancelled

### Generation and Provenance Events

* AssetProposed
* AssetGenerated
* AssetValidated
* AssetApproved
* ArtifactCreated
* ProvenanceRecorded

### External Host Events

* ExternalSessionRegistered
* ExternalSessionHeartbeatReceived
* ExternalAssignmentDispatched
* ExternalActivityPatchReceived
* ExternalSessionRevoked

## Suggested Domain Service Interfaces

```csharp
public interface IRoomSuitabilityPolicy
{
    bool CanHost(Room room, WorkItem workItem);
    bool CanHost(Room room, CollaborationKind collaborationKind);
}

public interface IAssignmentPolicy
{
    AssignmentDecision Evaluate(AgentResident agent, WorkItem workItem);
}

public interface IStructuralIntegrityPolicy
{
    StructuralValidationResult Validate(World world, StructuralChangeProposal proposal);
}

public interface IApprovalPolicy
{
    ApprovalRequirement Evaluate(ApprovalSubject subject);
}
```

## Persistence Notes

Not every domain type must map one-to-one with a table, but the persistence model should preserve aggregate boundaries and invariants.

Recommended persistence roots:

* World
* Region
* Room
* WorkItem
* CollaborationContext
* Artifact
* ProvenanceRecord
* ExternalAgentSession
* AgentResident
* UserResident
* WorkflowInstance

Read models and projections should be derived for rendering and API efficiency.

## Example Aggregate Behaviors

### WorkItem behaviors

* Accept()
* AssignAgent(AgentId agentId)
* Start()
* Block(string reason)
* Complete()
* Reject(string reason)

### Room behaviors

* AddObject(WorldObject worldObject)
* RemoveObject(WorldObjectId objectId)
* Rename(string name)
* Expand(GridRectangle newBounds)
* UpdateMood(MoodState mood)

### CollaborationContext behaviors

* AddAgent(AgentId agentId)
* AddUser(UserId userId)
* Start()
* UpdateProgress(ProgressValue progress)
* Complete()
* Cancel()

### ProvenanceRecord behaviors

* RecordValidation(ValidationResultRecord validation)
* Approve(ReviewerIdentity reviewer, DateTimeOffset approvedAt)

## Example C# Record Set

```csharp
public readonly record struct CollaborationContextId(Guid Value);
public readonly record struct ArtifactId(Guid Value);
public readonly record struct ProvenanceRecordId(Guid Value);
public readonly record struct ExternalAgentSessionId(Guid Value);

public sealed record ReviewerIdentity(Guid Id, string DisplayName, InitiatorKind Kind);
public sealed record ValidationResultRecord(string ValidatorName, bool Passed, string Message);
public sealed record ExternalReference(string SystemName, string ReferenceType, string ReferenceValue);
```

## Initial Modeling Decisions for v1

* simulation is grid-based canonically
* rendering may interpolate between grid points
* users are first-class occupants
* agents and users may collaborate in shared contexts
* one active collaboration context per work item is sufficient in v1
* one active external host session per agent is sufficient in v1
* structural expansion is part of the core world model from day one
* deterministic seeded world generation is required
* generation providers are pluggable, but provenance remains internal

## Open Design Considerations for Later

These are not blockers for v1, but they should be considered as the model evolves.

* whether regions need nested subregions or districts
* whether room semantics should be extensible via data-driven registries instead of enums
* whether object composition should support rich subcomponents
* whether occupant inventories need first-class modeling early
* whether relationship graphs between agents deserve dedicated aggregates
* whether workflow definitions should become their own aggregate roots

## Final Notes

A good domain model here should feel like city planning crossed with orchestration engineering.

The world must be structurally sound. The occupants must be legible. The work must be real. The collaborations must be more than decorative. The generated things must be governable. And the whole system must remain pleasant to implement in C# without dissolving into anemic records floating in a sea of handlers.

That is the bar this model is meant to set.
