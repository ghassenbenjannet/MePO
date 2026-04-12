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
