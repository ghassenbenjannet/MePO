# Shadow PO AI

Shadow PO AI is a modern product operations platform designed to replace Jira and Confluence while embedding AI assistance directly into the workflow.

## Tech stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- Zustand

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- Alembic
- Redis

## Repository structure

```text
frontend/   React application
backend/    FastAPI application
docs/       Product and architecture documentation
```

## Run with Docker

1. Copy `.env.example` to `.env` if you want local environment defaults.
2. Start the stack:

```bash
docker compose up --build
```

3. Open:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`

If Docker reports a container name conflict from an older local run, clean the previous stack with:

```bash
docker compose down --remove-orphans
```

## Docker services

- `frontend`: Vite development server
- `backend`: FastAPI application
- `postgres`: PostgreSQL database
- `redis`: Redis instance for cache and async jobs
