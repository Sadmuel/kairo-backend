# Kairo Backend Architecture

This document describes the architectural decisions and patterns used in the Kairo backend.

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Module Architecture](#module-architecture)
- [Authentication](#authentication)
- [Database Design](#database-design)
- [API Design](#api-design)
- [Error Handling](#error-handling)
- [Validation](#validation)
- [Security](#security)
- [Testing Strategy](#testing-strategy)
- [Key Design Decisions](#key-design-decisions)

## Overview

Kairo backend is built using NestJS, following a modular architecture where each feature is encapsulated in its own module. The application uses:

- **NestJS**: Framework providing dependency injection, modular structure, and decorators
- **Prisma**: Type-safe ORM for database operations
- **Passport**: Authentication middleware with JWT strategy
- **class-validator**: DTO validation with decorators

## Project Structure

```
src/
├── auth/                    # Authentication module
│   ├── decorators/          # Custom decorators (@CurrentUser)
│   ├── dto/                 # Data transfer objects
│   ├── guards/              # JWT auth guard
│   ├── strategies/          # Passport JWT strategy
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
│
├── users/                   # Users module (profile, statistics)
│   ├── dto/
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
│
├── days/                    # Days module (daily schedules)
│   ├── dto/
│   ├── pipes/               # Custom pipes (ParseDatePipe)
│   ├── days.controller.ts
│   ├── days.service.ts
│   └── days.module.ts
│
├── time-blocks/             # Time blocks module
├── notes/                   # Notes module
├── todos/                   # Todos module
├── events/                  # Events module (calendar events)
├── dashboard/               # Dashboard aggregation module
├── prisma/                  # Prisma service (database connection)
├── config/                  # Configuration validation
├── common/                  # Shared utilities
│
├── app.module.ts            # Root module
└── main.ts                  # Application entry point
```

## Module Architecture

Each feature module follows a consistent pattern:

```
module/
├── dto/
│   ├── create-*.dto.ts      # Creation payload
│   ├── update-*.dto.ts      # Update payload (partial)
│   └── index.ts             # Barrel export
├── *.controller.ts          # HTTP layer (routes, validation)
├── *.service.ts             # Business logic
├── *.module.ts              # Module definition
├── *.controller.spec.ts     # Controller tests
└── *.service.spec.ts        # Service tests
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| Controller | Route handling, request validation, response formatting |
| Service | Business logic, database operations, error handling |
| DTO | Request/response shape, validation rules |
| Module | Dependency registration, imports/exports |

## Authentication

### JWT + Refresh Token Strategy

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Login     │────▶│   Server    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────────────┐
                    │  Access Token (15m) │
                    │  Refresh Token (7d) │
                    └─────────────────────┘
```

**Key decisions:**

1. **Short-lived access tokens (15 minutes)**: Limits exposure if token is compromised
2. **Refresh token rotation**: Each refresh invalidates the old token, preventing reuse
3. **Token hashing**: Refresh tokens are SHA-256 hashed before storage
4. **Max tokens per user (5)**: Limits concurrent sessions, auto-removes oldest

### Why SHA-256 for Refresh Tokens?

Refresh tokens are cryptographically random (high entropy), so bcrypt's salting provides no additional benefit. SHA-256 is:
- Fast for validation (no performance impact)
- Sufficient to prevent token use if database is compromised
- Not susceptible to rainbow tables due to token randomness

### Authentication Flow

```
1. POST /auth/register → Create user, return UserResponseDto
2. POST /auth/login → Validate credentials, return tokens + user
3. POST /auth/refresh → Rotate refresh token, return new tokens
4. POST /auth/logout → Invalidate refresh token
5. GET /auth/me → Return current user (requires JWT)
```

## Database Design

### Entity Relationships

```
User (1) ──────< Day (N)
  │                │
  │                └───< TimeBlock (N)
  │                          │
  │                          ├───< Note (N)
  │                          │
  └──────< Todo (N) ◀────────┘
  │
  └──────< Event (N)
```

### Key Design Decisions

**1. Todo Context Flexibility**

Todos can belong to:
- A Day directly (day-level todos)
- A TimeBlock (block-specific todos)
- Neither (inbox/unassigned todos)

```sql
Todo
├── dayId (optional)
└── timeBlockId (optional)
```

**2. Order Management**

Time blocks, notes, and todos support drag-and-drop reordering via an `order` field:
- Unique constraint on `(parentId, order)` prevents duplicates
- `nextOrder` counter on parent entity for efficient new item creation
- Bulk reorder endpoint updates multiple items atomically

**3. Day Completion**

A Day is marked complete when all its TimeBlocks are completed. This is calculated automatically when a TimeBlock's `isCompleted` status changes.

**4. Streak Tracking**

User streaks are stored on the User model:
- `currentStreak`: Consecutive completed days ending today/yesterday
- `longestStreak`: All-time best streak
- `lastCompletedDate`: For streak calculation

Streaks update when a Day's completion status changes.

## API Design

### RESTful Conventions

| Method | Path | Action |
|--------|------|--------|
| GET | /resources | List all |
| GET | /resources/:id | Get one |
| POST | /resources | Create |
| PATCH | /resources/:id | Partial update |
| DELETE | /resources/:id | Delete |

### Nested Resources

Some resources use nested or contextual endpoints:

```
GET  /days/month/:year/:month    # Calendar month view
GET  /days/week/:date            # Calendar week view
GET  /users/me/stats             # Current user stats
GET  /users/me/stats/day/:date   # Daily stats
GET  /users/me/stats/week/:date  # Weekly stats
```

### Query Parameters

```
GET /todos?dayId=uuid           # Filter by day
GET /todos?timeBlockId=uuid     # Filter by time block
GET /todos?isCompleted=true     # Filter by status
GET /todos?inbox=true           # Unassigned todos only
```

### Response Format

All responses follow a consistent format:
- Single resource: Object with resource fields
- Collection: Array of resource objects
- No envelope (pagination not implemented)

## Error Handling

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE, logout) |
| 400 | Validation error, bad request |
| 401 | Unauthorized (missing/invalid token) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email) |
| 429 | Rate limit exceeded |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

## Validation

### DTO Validation

All incoming data is validated using class-validator decorators:

```typescript
export class CreateTodoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsUUID()
  dayId?: string;
}
```

### Global Validation Pipe

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,        // Strip unknown properties
    forbidNonWhitelisted: true,  // Reject unknown properties
    transform: true,        // Auto-transform types
  }),
);
```

## Security

### Rate Limiting

Auth endpoints have specific rate limits:
- Register: 5 requests per minute
- Login: 5 requests per minute
- Refresh: 10 requests per minute

### CORS

Configurable via `FRONTEND_URL` environment variable. In development, allows common localhost ports.

### Input Sanitization

- Prisma prevents SQL injection via parameterized queries
- class-validator prevents invalid data types
- `whitelist: true` strips unexpected fields

### Password Security

- bcrypt hashing with auto-generated salt
- Minimum 8 characters, maximum 128 (prevents bcrypt DoS)
- Timing attack prevention on login (always runs bcrypt.compare)

## Testing Strategy

### Unit Tests

Test services and controllers in isolation with mocked dependencies:

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: jest.Mocked<UsersService>;

  beforeEach(() => {
    mockUsersService = { findByEmail: jest.fn() };
    // ... setup
  });
});
```

### E2E Tests

Test full API flows with real database:

```typescript
describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Setup app with real modules
  });

  beforeEach(async () => {
    // Clean database
    await prisma.user.deleteMany();
  });
});
```

### Coverage Goals

- Services: 90%+ coverage on business logic
- Controllers: Route handling and error cases
- E2E: Critical user flows (auth, CRUD operations)

## Key Design Decisions

### 1. No User Lookup in JWT Validation

The JWT strategy returns user data from the token payload without a database lookup:

**Rationale:**
- Access tokens are short-lived (15 min)
- JWT signature is cryptographically verified
- Eliminates N+1 queries on every request
- User status changes apply on next token refresh

### 2. Refresh Token Rotation

Each refresh invalidates the old token:

**Rationale:**
- Limits window for token theft
- Detects token reuse (race condition = compromised)
- Automatic cleanup of old tokens

### 3. Date Handling

Dates are stored as `DateTime @db.Date` (date-only, no time):

**Rationale:**
- Days are timezone-agnostic
- Prevents time-related bugs
- Simpler date comparisons

### 4. Order Field for Sorting

Uses integer `order` field instead of linked list:

**Rationale:**
- Simple bulk updates for reordering
- Efficient queries with `ORDER BY order`
- Database-level unique constraint

### 5. Dashboard Aggregation

Single endpoint combines multiple data sources:

**Rationale:**
- Reduces client-side requests
- Parallel database queries for performance
- Consistent data snapshot

---

## Future Considerations

- **Caching**: Redis for user sessions and frequent queries
- **Pagination**: Cursor-based pagination for large datasets
- **WebSockets**: Real-time updates for collaborative features
- **Background Jobs**: Scheduled streak calculations, cleanup tasks
