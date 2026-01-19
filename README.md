# Kairo Backend

REST API for Kairo - a productivity application combining time-blocking, routines, and task management.

## Overview

Kairo helps users organize their days through customizable time blocks where they can assign specific tasks and notes. Unlike traditional calendar apps, it focuses on dividing days into structured sections while maintaining the flexibility of todo lists.

## Features

- **Authentication**: JWT-based auth with refresh token rotation
- **Days & Time Blocks**: Create and manage daily schedules with time-bound blocks
- **Todos**: Task management at day-level or within time blocks
- **Notes**: Add notes to time blocks for additional context
- **Events**: Calendar events with recurrence support (daily, weekly, monthly, yearly)
- **Statistics**: Track streaks, completion rates, and daily/weekly stats
- **Dashboard**: Aggregated view of today's schedule, stats, and upcoming events

## Tech Stack

- **Runtime**: Node.js 22+
- **Framework**: NestJS 11
- **Language**: TypeScript 5
- **ORM**: Prisma 6
- **Database**: PostgreSQL 16
- **Authentication**: JWT with Passport
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest + Supertest

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for local database)
- PostgreSQL 16 (if not using Docker)

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/Sadmuel/kairo-backend.git
cd kairo-backend
pnpm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kairo?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Optional
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
```

### 3. Start Database

```bash
docker compose up -d
```

### 4. Run Migrations

```bash
pnpm prisma migrate dev
```

### 5. Start Development Server

```bash
pnpm start:dev
```

The API will be available at `http://localhost:3000`

## API Documentation

Swagger documentation is available at `http://localhost:3000/api` when the server is running.

### Main Endpoints

| Module      | Endpoint                       | Description                   |
| ----------- | ------------------------------ | ----------------------------- |
| Auth        | `POST /auth/register`          | Register new user             |
| Auth        | `POST /auth/login`             | Login and get tokens          |
| Auth        | `POST /auth/refresh`           | Refresh access token          |
| Auth        | `GET /auth/me`                 | Get current user              |
| Days        | `GET /days/month/:year/:month` | Get days for month view       |
| Days        | `GET /days/week/:date`         | Get days for week view        |
| Days        | `POST /days`                   | Create a new day              |
| Time Blocks | `POST /time-blocks`            | Create time block             |
| Time Blocks | `PATCH /time-blocks/reorder`   | Reorder time blocks           |
| Todos       | `GET /todos`                   | Get todos with filters        |
| Todos       | `PATCH /todos/:id/move`        | Move todo between contexts    |
| Events      | `GET /events/calendar`         | Get events for date range     |
| Statistics  | `GET /users/me/stats`          | Get user statistics           |
| Dashboard   | `GET /dashboard`               | Get aggregated dashboard data |

## Project Structure

```
src/
├── auth/               # Authentication (JWT, guards, strategies)
├── users/              # User management and statistics
├── days/               # Day CRUD and calendar views
├── time-blocks/        # Time block management
├── notes/              # Notes within time blocks
├── todos/              # Todo management
├── events/             # Calendar events with recurrence
├── dashboard/          # Aggregated dashboard endpoint
├── prisma/             # Prisma service
├── common/             # Shared utilities
├── config/             # Configuration validation
├── app.module.ts
└── main.ts
```

## Database Schema

```
User
├── Days[]
├── Events[]
├── Todos[]
└── RefreshTokens[]

Day
├── TimeBlocks[]
└── Todos[] (day-level)

TimeBlock
├── Notes[]
└── Todos[] (block-level)
```

## Scripts

```bash
# Development
pnpm start:dev          # Start with hot reload
pnpm start:debug        # Start with debugger

# Build
pnpm build              # Build for production
pnpm start:prod         # Run production build

# Database
pnpm prisma migrate dev     # Run migrations (dev)
pnpm prisma migrate deploy  # Run migrations (prod)
pnpm prisma studio          # Open Prisma Studio

# Testing
pnpm test               # Run unit tests
pnpm test:watch         # Run tests in watch mode
pnpm test:cov           # Run tests with coverage
pnpm test:e2e           # Run e2e tests

# Code Quality
pnpm lint               # Run ESLint
pnpm format             # Format with Prettier
```

## Testing

The project has comprehensive test coverage:

- **Unit Tests**: Service and controller tests with mocked dependencies
- **E2E Tests**: Full API tests with real database

```bash
# Run all tests
pnpm test

# Run with coverage report
pnpm test:cov

# Run e2e tests
pnpm test:e2e
```

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Short-lived access tokens (15min) with refresh rotation
- **Rate Limiting**: Throttling on auth endpoints
- **CORS**: Configurable origin whitelist
- **Input Validation**: class-validator on all DTOs
- **SQL Injection Prevention**: Prisma ORM with parameterized queries

## Environment Variables

| Variable       | Required  | Default       | Description                  |
| -------------- | --------- | ------------- | ---------------------------- |
| `DATABASE_URL` | Yes       | -             | PostgreSQL connection string |
| `JWT_SECRET`   | Yes       | -             | Secret key for JWT signing   |
| `NODE_ENV`     | No        | `development` | Environment mode             |
| `PORT`         | No        | `3000`        | Server port                  |
| `FRONTEND_URL` | Prod only | -             | Frontend URL for CORS        |

## Deployment

### Render (Recommended)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set environment variables
4. Deploy

### Docker

```bash
# Build image
docker build -t kairo-backend .

# Run container
docker run -p 3000:3000 --env-file .env kairo-backend
```

## Related

- [Kairo Frontend](https://github.com/YOUR_USERNAME/kairo-frontend) - React frontend application

## License

MIT
