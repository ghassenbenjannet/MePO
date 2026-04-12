# Architecture Overview

## Monorepo structure

```text
frontend/
  src/
    app/
    components/
    data/
    lib/
    pages/
    stores/
    types/
backend/
  app/
    api/
    core/
    models/
    repositories/
    schemas/
    services/
```

## Backend layers

- `api/` HTTP route definitions
- `schemas/` request and response contracts
- `models/` SQLAlchemy persistence models
- `repositories/` data access helpers
- `services/` orchestration and business logic
- `core/` shared configuration and infrastructure

## Current frontend product map

- `/login` authentication entry
- `/onboarding` first-run project creation
- `/` dashboard
- `/projects/:projectId` project overview
- `/projects/:projectId/spaces/:spaceId` space hub
- `/projects/:projectId/spaces/:spaceId/topics/:topicId` topic workspace
