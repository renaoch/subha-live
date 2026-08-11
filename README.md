# My Turborepo

A scalable monorepo for building a social and real-time streaming application.

The project is designed around a modular backend architecture with Supabase/PostgreSQL for persistent application data, Redis for high-frequency and ephemeral realtime state, and a Turborepo + pnpm workspace for managing multiple applications and shared packages.

> This project is currently under active development.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Technology Stack](#technology-stack)
- [Backend](#backend)
- [Authentication](#authentication)
- [User System](#user-system)
- [Current API](#current-api)
- [Database](#database)
- [Data Ownership](#data-ownership)
- [Redis Architecture](#redis-architecture)
- [Security](#security)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Running the API](#running-the-api)
- [Testing the API](#testing-the-api)
- [Database Development](#database-development)
- [Project Development Principles](#project-development-principles)
- [Roadmap](#roadmap)
- [Scaling Strategy](#scaling-strategy)
- [Contributing](#contributing)
- [License](#license)

---

# Overview

This repository contains the main codebase for a social and real-time streaming platform.

The application is being developed as a monorepo so that the frontend, backend, shared packages, database configuration, realtime infrastructure, and future background workers can evolve together.

The backend is currently being built incrementally, starting with:

- Authentication
- User profiles
- Public profiles
- Profile updates
- Social relationships
- Posts
- Comments
- Likes
- Notifications
- Realtime streaming
- Redis-based realtime state
- Background workers
- Scalable event processing

The system is intentionally being built in layers rather than attempting to implement the entire application at once.

---

# Architecture

The project follows a modular architecture.

At a high level:

```text
                        Client
                          |
                          v
                     API Gateway
                          |
                    Express API
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
      Supabase          Redis          Workers
      /Postgres        /Realtime       /Queues
          |               |               |
          +---------------+---------------+
                          |
                          v
                    Application
                       State
```

The main responsibility of each component is different.

## PostgreSQL / Supabase

PostgreSQL is the source of truth for permanent application data.

Examples:

- users
- profiles
- follows
- posts
- comments
- likes
- notifications
- moderation data
- financial data
- stream history
- persistent application state

## Redis

Redis is used for high-speed and temporary state.

Examples:

- live viewers
- presence
- heartbeats
- typing indicators
- live room state
- temporary counters
- realtime state
- hot caches
- high-frequency event buffering

## Workers

Background workers will process operations that do not need to happen synchronously inside an API request.

Examples:

- batching high-volume events
- processing Redis streams
- writing aggregated analytics
- cleaning expired state
- asynchronous notifications
- other background jobs

---

# Repository Structure

The repository is organized as a Turborepo.

```text
my-turborepo/
│
├── apps/
│   │
│   ├── api/
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   └── users/
│   │   │   └── server.ts
│   │   └── package.json
│   │
│   └── ...
│
├── packages/
│   └── ...
│
├── supabase/
│   └── ...
│
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

The repository is intended to grow into:

```text
apps/
├── api/
├── web/
├── worker/
└── ...

packages/
├── shared/
├── validation/
├── config/
└── ...
```

The exact structure may evolve as the application grows.

---

# Technology Stack

## Monorepo

- Turborepo
- pnpm workspaces

## Backend

- Node.js
- Express
- TypeScript
- Zod

## Database

- PostgreSQL
- Supabase
- Supabase-generated TypeScript database types

## Authentication

- Supabase Auth
- Bearer access tokens
- Express authentication middleware

## Realtime / Scaling

- Redis
- Redis-based ephemeral state
- Redis Streams / durable event processing planned
- Background workers planned

## API Architecture

The backend follows a modular structure:

```text
module/
├── controller
├── service
├── routes
├── middleware
└── schema
```

This keeps HTTP concerns separate from application logic and database operations.

---

# Backend

The API lives inside:

```text
apps/api
```

The backend is organized by application domain rather than putting every controller, service, and route into global folders.

Example:

```text
apps/api/src/modules/

auth/
├── auth.controller.ts
├── auth.middleware.ts
├── auth.routes.ts
└── auth.service.ts

users/
├── users.controller.ts
├── users.routes.ts
├── users.schema.ts
└── users.service.ts
```

The purpose of this structure is to make each feature independently understandable and easier to extend.

---

# Authentication

Authentication is handled by Supabase Auth.

The authentication flow is:

```text
Client
  |
  | Authorization: Bearer <token>
  v
Express
  |
  v
Authentication Middleware
  |
  v
Supabase Auth
  |
  v
Authenticated User
  |
  v
req.user
```

The API separates authentication identity from the application's user profile.

## Supabase Auth user

The authentication layer contains identity information such as:

- user ID
- email
- authentication provider
- authentication metadata
- session information

## Application profile

The application layer stores information such as:

- name
- handle
- avatar
- bio
- country
- level
- followers
- following
- application-specific state

This separation allows the authentication system and application profile system to evolve independently.

---

# Authentication Endpoint

## GET `/api/v1/auth/me`

Returns the authenticated Supabase user.

Example:

```http
GET /api/v1/auth/me
Authorization: Bearer <TOKEN>
```

Response:

```json
{
  "status": "ok",
  "user": {
    "id": "...",
    "email": "..."
  }
}
```

This endpoint represents the authentication layer.

It does not replace `/users/me`.

---

# User System

The user system represents the application-level profile associated with the authenticated identity.

Current endpoints:

```text
GET   /api/v1/users/me
GET   /api/v1/users/:id
PATCH /api/v1/users/me
```

---

# GET `/api/v1/users/me`

Returns the authenticated user's application profile.

Example:

```http
GET /api/v1/users/me
Authorization: Bearer <TOKEN>
```

The endpoint reads the authenticated user's ID from:

```ts
req.user.id
```

and retrieves the corresponding row from the `profiles` table.

---

# GET `/api/v1/users/:id`

Returns the public profile of a user.

Example:

```http
GET /api/v1/users/<USER_ID>
```

The endpoint intentionally returns a smaller set of fields than the authenticated user's profile.

Public profile data currently includes fields such as:

- id
- name
- handle
- avatar
- bio
- country
- country flag
- level
- VIP information
- verification status
- followers
- following
- created_at
- gender

Sensitive administrative and financial fields are not exposed through this endpoint.

A dedicated public-profile database view/schema may be introduced later.

---

# PATCH `/api/v1/users/me`

Updates the authenticated user's application profile.

Example:

```http
PATCH /api/v1/users/me
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

Example body:

```json
{
  "name": "Renao",
  "handle": "renao",
  "bio": "Building something."
}
```

Only explicitly allowed fields can be modified through this endpoint.

Current editable fields:

```text
name
handle
avatar
bio
country
country_flag
gender
```

Protected fields such as:

```text
coins
diamonds
level
vip_level
svip
is_verified
followers
following
is_admin
role
```

are not accepted as user-controlled updates.

---

# Request Validation

Profile updates are validated before reaching the database.

The validation flow is:

```text
Request
   |
   v
Authentication
   |
   v
Zod validation
   |
   v
Allowed fields
   |
   v
User service
   |
   v
PostgreSQL
```

Validation is responsible for:

- field types
- string lengths
- URL validation
- handle format
- unknown fields
- nullable fields
- malformed requests

The goal is to prevent invalid or unauthorized data from reaching the database.

---

# Database

Supabase provides PostgreSQL as the application's primary persistent database.

The database schema is version-controlled under:

```text
supabase/
```

Generated database types are used by the API:

```ts
import type { Database } from "../../types/database.types";
```

This allows the service layer to remain aligned with the actual PostgreSQL schema.

For example:

```ts
type UserId =
  Database["public"]["Tables"]["profiles"]["Row"]["id"];
```

and:

```ts
type ProfileUpdate =
  Database["public"]["Tables"]["profiles"]["Update"];
```

This prevents the API from casually inventing database columns that do not exist.

---

# Profiles

The `profiles` table contains application-level user data.

Examples include:

```text
id
name
handle
avatar
bio
country
country_flag
level
vip_level
svip
is_verified
coins
diamonds
followers
following
created_at
gender
is_admin
role
```

Not every field is exposed through every API endpoint.

The API intentionally controls which fields are returned to clients.

---

# Social Graph

The application uses a `follows` relationship table.

Conceptually:

```text
follows

follower_id
following_id
created_at
```

The relationship is represented as:

```text
User A
  |
  | follows
  v
User B
```

The relationship is stored in PostgreSQL and acts as the authoritative source of truth.

Follower/following counters can be cached separately for fast reads.

---

# Posts

Posts are persistent application data and belong in PostgreSQL.

Post-related data includes:

- post ownership
- content
- media
- timestamps
- engagement counters
- comments
- likes

Redis may later be used for hot counters and high-volume event processing, but the permanent post record remains in PostgreSQL.

---

# Likes

Likes represent a persistent relationship between a user and a post.

The database uses a relationship table conceptually equivalent to:

```text
post_likes

post_id
user_id
created_at
```

The relationship prevents duplicate likes.

For high traffic, the system is designed to support:

```text
Client
  |
  v
API
  |
  +------> Redis counter/cache
  |
  +------> durable event processing
                  |
                  v
              PostgreSQL
```

The Redis layer is used for performance.

PostgreSQL remains the source of truth for the actual relationship.

---

# Comments

Comments are persistent content.

Unlike temporary stream presence, comments cannot simply disappear when Redis expires.

At higher traffic levels, comments may use asynchronous buffering:

```text
Client
  |
  v
API
  |
  v
Redis / durable event stream
  |
  v
Worker
  |
  v
PostgreSQL
```

The final comment remains stored in PostgreSQL.

---

# Notifications

Notifications are persistent application records.

Redis can be used for:

- unread counters
- realtime delivery
- temporary notification state

PostgreSQL stores the notification record itself.

---

# Streaming Architecture

Streaming contains two fundamentally different types of data.

## Persistent stream data

Stored in PostgreSQL:

```text
stream/session identity
started_at
ended_at
duration
total_views
peak_viewers
stream metadata
```

## Ephemeral live state

Stored in Redis:

```text
current viewers
presence
viewer heartbeats
typing indicators
active room members
current viewer count
temporary room state
```

The live viewer state does not need to be permanently written to PostgreSQL.

Example:

```text
User joins stream
       |
       v
Redis
       |
       v
current viewer state
```

When the stream ends:

```text
Redis
  |
  v
calculate final statistics
  |
  v
PostgreSQL
```

This avoids generating unnecessary database writes for every heartbeat and viewer join/leave operation.

---

# Redis Data Ownership

Redis is divided conceptually into several categories.

## Redis-only

Ephemeral data that can disappear:

```text
viewer presence
heartbeats
typing indicators
current room members
temporary room state
live viewer count
```

These values can use TTLs.

---

## Redis → PostgreSQL batch

High-volume data where individual events do not necessarily need permanent storage:

```text
stream views
profile visits
post impressions
analytics events
engagement metrics
watch-time events
```

Example:

```text
Redis
  |
  | aggregate
  v
Worker
  |
  v
PostgreSQL
```

---

## Redis + PostgreSQL

Data requiring fast access and permanent storage.

Example:

```text
Follower count

Redis:
user:<id>:followers

PostgreSQL:
profiles.followers
follows
```

Redis provides fast access.

PostgreSQL remains authoritative.

If Redis is lost, cached values can be rebuilt from PostgreSQL.

---

# Durable Events

Some events cannot be safely treated as temporary Redis state.

Examples:

```text
follow
unfollow
like
comment
post creation
gift
coin transaction
purchase
moderation action
```

For high-volume operations, the intended architecture is:

```text
Client
  |
  v
API
  |
  v
Durable event stream / queue
  |
  v
Worker
  |
  v
PostgreSQL
```

This allows the system to absorb traffic spikes without requiring every request to perform a synchronous database write.

Redis may participate in this architecture, but ordinary volatile Redis keys should not be the only copy of an important event.

---

# Security

The backend follows several security principles.

## Authentication

Protected endpoints require authentication.

```text
Authorization: Bearer <TOKEN>
```

Authentication middleware verifies the token before protected controllers execute.

---

## Field Whitelisting

Client-controlled updates are explicitly limited.

For example, a client cannot modify:

```text
coins
diamonds
is_admin
role
level
followers
following
```

simply by adding those properties to a PATCH request.

---

## Public Data Separation

Public profile endpoints deliberately return fewer fields than authenticated profile endpoints.

This prevents accidental exposure of internal application state.

---

## Environment Secrets

Secrets must never be committed to Git.

Never commit:

```text
.env
.env.local
.env.production
```

The repository should contain only example configuration:

```text
.env.example
```

Example:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Never put actual production credentials in this file.

---

# Environment Variables

The API currently requires Supabase configuration.

Example:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

The service-role key must remain server-side.

It must never be exposed to the browser or committed to GitHub.

---

# Local Development

## Requirements

Install:

- Node.js
- pnpm
- Git

The repository uses pnpm workspaces and Turborepo.

---

## Install Dependencies

From the repository root:

```bash
pnpm install
```

---

## Run Development

Run the API:

```bash
pnpm --filter api dev
```

Or run the monorepo development tasks:

```bash
pnpm dev
```

depending on the current workspace scripts.

---

# API Development

The API lives at:

```text
apps/api
```

The backend can be started with:

```bash
pnpm --filter api dev
```

The development server currently runs on:

```text
http://localhost:3000
```

API routes are versioned under:

```text
/api/v1
```

---

# Testing Authentication

A development token can be generated through the project's token script.

Example:

```bash
TOKEN=$(pnpm --filter api exec tsx src/scripts/get-token.ts | tail -n 1)
```

Then:

```bash
curl -i http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

# Testing User APIs

## Get authenticated user

```bash
curl -i http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN"
```

## Get public profile

```bash
curl -i http://localhost:3000/api/v1/users/<USER_ID>
```

## Update profile

```bash
curl -i -X PATCH http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Building my application."
  }'
```

---

# API Error Handling

The API uses centralized error handling.

Services should not expose sensitive database or infrastructure details directly to clients.

The intended flow is:

```text
Database error
      |
      v
Service
      |
      v
Application error
      |
      v
Global error middleware
      |
      v
Safe HTTP response
```

Internal details should be logged server-side rather than returned directly to clients.

---

# Development Principles

The project follows several principles.

## 1. PostgreSQL is the source of truth

Permanent application state belongs in PostgreSQL.

Redis should not become an accidental database.

---

## 2. Redis is for speed and temporary state

Redis is used when:

- state is ephemeral
- reads need to be extremely fast
- counters are hot
- realtime state changes frequently
- events need buffering

---

## 3. Durable events must be recoverable

Important events such as:

```text
likes
comments
follows
transactions
```

must have a durable processing path.

A volatile cache alone is not enough.

---

## 4. API boundaries should be explicit

Controllers handle HTTP concerns.

Services handle application/database operations.

Schemas handle request validation.

Middleware handles cross-cutting concerns such as authentication.

---

## 5. Database types should be generated

The API uses generated Supabase database types rather than manually duplicating database structures throughout the codebase.

---

## 6. Build for scale without prematurely distributing everything

The system is designed to support large traffic spikes, but infrastructure should be introduced when the feature requires it.

The goal is not to deploy multiple distributed systems before they are necessary.

---

# Roadmap

## Phase 1 - Foundation

- [x] Turborepo setup
- [x] pnpm workspace
- [x] Express API
- [x] Supabase connection
- [x] Supabase generated types
- [x] Authentication middleware
- [x] `/auth/me`
- [x] `/users/me`
- [x] `/users/:id`
- [x] `PATCH /users/me`
- [x] Complete request validation
- [x] Centralized application errors

---

## Phase 2 - Social Graph

- [x] Follow user
- [x] Unfollow user
- [ ] Followers list
- [ ] Following list
- [ ] Follow state
- [ ] Block user
- [ ] Mute user
- [ ] Social graph optimization

---

## Phase 3 - Content

- [ ] Create posts
- [ ] Update posts
- [ ] Delete posts
- [ ] Fetch posts
- [ ] Feed
- [ ] Comments
- [ ] Likes
- [ ] Post engagement
- [ ] Media handling

---

## Phase 4 - Notifications

- [ ] Notification service
- [ ] Notification persistence
- [ ] Unread counters
- [ ] Realtime notifications
- [ ] Notification preferences

---

## Phase 5 - Redis

- [ ] Redis connection
- [ ] Redis key conventions
- [ ] TTL strategy
- [ ] Realtime presence
- [ ] Stream viewer state
- [ ] Hot counters
- [ ] Cache invalidation
- [ ] Redis monitoring

---

## Phase 6 - Realtime Streaming

- [ ] Live rooms
- [ ] Viewer presence
- [ ] Heartbeats
- [ ] Room state
- [ ] Viewer counters
- [ ] Stream lifecycle
- [ ] Stream statistics
- [ ] Stream cleanup

---

## Phase 7 - Event Processing

- [ ] Durable event stream
- [ ] Background workers
- [ ] Batched writes
- [ ] Event retries
- [ ] Dead-letter handling
- [ ] Idempotent processing
- [ ] Event monitoring

---

## Phase 8 - Production Hardening

- [ ] Rate limiting
- [ ] Request validation
- [ ] Security headers
- [ ] CORS configuration
- [ ] Logging
- [ ] Metrics
- [ ] Health checks
- [ ] Database monitoring
- [ ] Redis monitoring
- [ ] Error tracking
- [ ] Load testing
- [ ] Backup strategy

---

# Scaling Strategy

The application is designed around a layered scaling model.

## Low traffic

```text
Client
  |
  v
Express
  |
  v
PostgreSQL
```

Simple and reliable.

## Higher traffic

```text
Client
  |
  v
Express
  |
  +---- Redis
  |
  +---- PostgreSQL
```

Redis handles hot state and caching.

## High-volume event traffic

```text
Client
  |
  v
API
  |
  v
Redis / Event Stream
  |
  v
Workers
  |
  v
PostgreSQL
```

This allows high-volume operations to be processed asynchronously.

## Realtime streaming

```text
Clients
   |
   v
Realtime Layer
   |
   v
Redis
   |
   +---- viewer state
   +---- presence
   +---- room state
   +---- counters
   |
   v
Stream Worker
   |
   v
PostgreSQL
```

The system intentionally avoids writing every ephemeral realtime event directly to PostgreSQL.

---

# Data Consistency Model

Different data uses different consistency requirements.

## Strong consistency

Used for:

- financial transactions
- permissions
- account state
- follows
- persistent content
- moderation

These should have authoritative PostgreSQL state.

## Eventual consistency

Used for:

- analytics
- counters
- impressions
- stream statistics
- profile visits

These can be aggregated asynchronously.

## Ephemeral consistency

Used for:

- presence
- viewer state
- typing
- heartbeats
- temporary room state

These live in Redis and can disappear without affecting permanent application state.

---

# Production Philosophy

The architecture is designed around a simple rule:

> Use the simplest storage system that satisfies the consistency, durability, and performance requirements of the data.

PostgreSQL is not a realtime presence database.

Redis is not the permanent source of truth for financial or social relationships.

The API should not perform unnecessary synchronous writes for high-frequency ephemeral events.

Workers should handle expensive or asynchronous operations.

This separation allows each component to do what it is good at.

---

# Contributing

The project is currently under active development.

When adding a new backend feature, prefer the following structure:

```text
modules/
└── feature/
    ├── feature.controller.ts
    ├── feature.service.ts
    ├── feature.routes.ts
    ├── feature.schema.ts
    └── feature.middleware.ts
```

Keep:

- HTTP handling in controllers
- business/database operations in services
- validation in schemas
- authentication/authorization in middleware
- infrastructure access in dedicated infrastructure/lib modules

Avoid putting database queries directly inside route definitions.

---

# License

License information will be added as the project approaches public release.
