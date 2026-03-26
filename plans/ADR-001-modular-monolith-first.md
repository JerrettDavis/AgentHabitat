# ADR-001-modular-monolith-first.md

## Status

Accepted

## Date

2026-03-25

## Decision

Agent Habitat will be built as a **modular monolith first**.

The initial implementation will run as a single deployable application composed of strongly bounded internal modules rather than as a distributed set of microservices. These modules will have explicit contracts, well-defined responsibilities, clear dependency rules, and architecture tests that enforce separation.

The system is expected to support future extraction of selected modules into separate services if operational evidence justifies it, but service extraction is not the starting architecture.

## Context

Agent Habitat has several substantial concerns that could tempt premature service decomposition:

* real-time world simulation
* work orchestration
* collaboration management
* pluggable generation pipelines
* provenance and approvals
* external host integrations through MCP, hooks, plugins, and similar mechanisms
* a first-class user-facing client with live updates

At a glance, this looks like the sort of product that could be split into simulation services, generation workers, orchestration services, projection services, and integration gateways from day one.

That would be a mistake.

This product is early, highly exploratory, and still defining its core seams. The largest risks are not horizontal scale and fleet management. The real risks are semantic confusion, over-abstraction, brittle contracts, accidental duplication of concepts, and spending weeks designing service boundaries before the underlying domain has settled.

We are building a world simulation, a work system, and a social environment at the same time. Those parts are related in deep ways. An agent walking from a lounge to a coding room is not just a rendering concern. It can reflect task assignment, workflow state, room suitability, collaboration context, approval flows, and provenance-generating side effects. That is exactly the kind of behavior that becomes painful when spread across a half-dozen services before the model is mature.

A modular monolith lets us keep those concepts close while still being disciplined about separation.

## Rationale

### 1. The domain boundaries are real, but still settling

We already know some major modules exist:

* Domain
* Semantics
* Simulation
* Orchestration
* Generation
* Application
* Infrastructure
* API
* Client
* MCP and external host integrations

That is enough to justify modularity, but not enough to justify separate deployables. We should first prove that these are the right seams in code and in behavior.

### 2. The product needs high iteration speed

We are likely to revise:

* task lifecycles
* collaboration modeling
* room semantics
* structural expansion rules
* generation approval flows
* external host session contracts
* projection models

In a distributed architecture, every such change becomes a contract negotiation problem. In a modular monolith, these changes still require discipline, but they do not impose network overhead, distributed transactions, version skew, or deployment choreography on every design iteration.

### 3. Real-time coordination is easier when the state is close

The system needs to keep simulation state, assignment state, collaboration state, and world projection in sync. Keeping that inside one deployable significantly reduces the number of failure modes in v1.

We still need explicit boundaries, but we do not need network boundaries yet.

### 4. Operational simplicity matters

A modular monolith is easier to:

* run locally
* compose with Aspire
* debug end-to-end
* trace in development
* test deterministically
* deploy for early adopters
* reason about during active design changes

This is especially important because the platform already has enough moving parts without adding distributed-system tax up front.

### 5. We can still prepare for extraction

A modular monolith is not an excuse for a big ball of mud.

We should still:

* define explicit module boundaries
* keep stable internal contracts
* publish domain events for important transitions
* isolate infrastructure behind interfaces
* maintain projection models separate from domain models
* enforce dependency rules with architecture tests

If a module later proves operationally noisy, computationally heavy, or independently scalable, we will already have a good starting seam for extraction.

## What This Means Practically

### Deployment Model

The initial production topology will center on a single application runtime hosting:

* API endpoints
* SignalR hubs
* application coordination logic
* simulation runtime
* orchestration runtime
* generation pipeline coordination
* integration endpoints for external hosts
* projection updates

The app will depend on external infrastructure such as:

* PostgreSQL
* Redis
* object storage
* optional external generation providers

This is still a distributed system in the broad sense, but the **core application runtime** remains a single deployable.

### Module Boundaries

The codebase should be structured as a modular solution with separate projects such as:

```text
/src
  /AgentHabitat.Domain
  /AgentHabitat.Semantics
  /AgentHabitat.Simulation
  /AgentHabitat.Orchestration
  /AgentHabitat.Generation
  /AgentHabitat.Application
  /AgentHabitat.Infrastructure
  /AgentHabitat.Api
  /AgentHabitat.Client
  /AgentHabitat.Mcp
  /AgentHabitat.Integrations.ExternalHosts
```

These modules should not be treated as folders with vibes. They are architectural boundaries.

### Allowed Dependency Direction

A reasonable initial dependency shape is:

* `Domain` depends on nothing application-specific
* `Semantics`, `Simulation`, `Orchestration`, and `Generation` may depend on `Domain`
* `Application` may depend on `Domain`, `Semantics`, `Simulation`, `Orchestration`, and `Generation`
* `Infrastructure` may depend on the lower-level abstractions it implements
* `Api` depends on `Application` and contract surfaces
* `Client` depends on API or shared contracts, not directly on persistence or domain internals
* `Mcp` and external integration modules depend on `Application` and integration contracts, not on storage internals

Architecture tests should enforce these boundaries.

## Benefits

### Faster iteration

We can change internal contracts and flows more quickly while the product is still finding itself.

### Easier local development

One runtime is much easier to bring up, inspect, debug, and test.

### Lower operational burden

We avoid service discovery, message contracts, deployment orchestration, and failure handling across many internal services before we need them.

### Better design pressure

If a module boundary is painful inside a monolith, splitting it into a service would likely make it worse rather than better.

### More trustworthy real-time behavior

State consistency is easier to achieve when simulation, orchestration, and projection are coordinated in-process.

## Drawbacks

### Large deployable over time

If left undisciplined, the application could become too large and tightly coupled.

### Shared process resource contention

Heavy generation or simulation activity can affect other concerns if we do not isolate execution paths and protect resources properly.

### Eventual extraction work

If we later split modules into services, that extraction will still require effort.

These drawbacks are real, but they are manageable, and they are lower risk than premature decomposition.

## Mitigations

To keep the modular monolith healthy, we will:

### 1. Enforce boundaries with tests

Use architecture tests to prevent forbidden dependencies.

### 2. Keep contracts explicit

Use strong types, command models, domain events, and clear interfaces rather than reaching across modules casually.

### 3. Separate reads from writes where helpful

Projection models, SignalR payloads, and render models should not become accidental domain backdoors.

### 4. Isolate expensive work

Generation providers, heavy processing, and long-running integrations should use background execution patterns or worker abstractions even if they remain in the same deployable initially.

### 5. Instrument everything

Observability is what tells us whether extraction is actually needed.

## Extraction Criteria

We should only split modules into separate services when there is concrete evidence, such as:

* generation workloads causing unacceptable contention with interactive traffic
* simulation requiring separate scaling characteristics
* integration traffic requiring isolation for security or reliability reasons
* deployment cadence needing to differ materially between modules
* operational ownership genuinely splitting across teams
* observability showing that in-process coordination is the bottleneck

“Because microservices are modern” is not a criterion.

## Alternatives Considered

### Microservices from day one

Rejected.

Why:

* too much operational and conceptual overhead
* premature hardening of unstable boundaries
* slower iteration on a still-emerging domain
* unnecessary network and deployment complexity for v1

### Single project monolith with loose folders

Rejected.

Why:

* insufficient architectural discipline
* too easy for concerns to bleed together
* hard to extract later because nothing is actually separated

### Event-sourced distributed core from day one

Rejected for v1.

Why:

* too much complexity for the current stage
* likely to slow implementation and obscure the real design work
* not necessary to achieve determinism, provenance, or replay-friendly features in the initial system

## Consequences

### Positive Consequences

* the team can move quickly while preserving structure
* the core model can evolve without constant network contract churn
* the app is easier to run locally and in Aspire
* the codebase gains real architectural seams suitable for future extraction

### Negative Consequences

* we must actively police modular discipline
* the deployable may grow broad over time
* we will need to revisit extraction later if evidence warrants it

## Follow-On Decisions

This ADR implies and supports several future decisions:

* use architecture tests to enforce module boundaries
* define domain events for major transitions without forcing distributed messaging everywhere
* keep external host integration behind explicit session and adapter abstractions
* isolate generation providers and heavy jobs behind interfaces and execution boundaries
* favor projection models for UI and streaming rather than exposing domain internals directly

## Implementation Notes

Initial enforcement should include:

* dedicated projects per module
* no direct EF Core entity leakage into client or API contracts
* no direct infrastructure access from domain entities
* no client dependency on persistence assemblies
* no external integration adapters bypassing application policies

Recommended tests:

* `Domain` must not depend on `Infrastructure`, `Api`, `Client`, or integration modules
* `Client` must not depend on `Infrastructure`
* `Api` must not bypass `Application` for core use cases
* `ExternalHosts` adapters must not directly mutate persistence state without going through application services

## Final Statement

We are building a world before we are building a federation.

Agent Habitat needs the discipline of modular boundaries, but not the burden of distributed deployment by default. A modular monolith gives us the speed to discover the right architecture, the structure to keep the codebase healthy, and the seams to extract services later when the system proves it needs them.
