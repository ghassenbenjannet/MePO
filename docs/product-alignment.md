# Product Alignment Notes

## Existing screens

- Login: implemented
- Onboarding: implemented
- Dashboard: implemented and moved to light-first
- Project page: implemented with richer product overview
- Space hub: implemented with clearer module positioning
- Topic page: implemented
- Backlog / Documents / Chat dedicated views: missing

## Main gaps against target

- Dark-first visual language instead of light-first
- Product hierarchy not fully visible in navigation
- No explicit topic-level workspace
- AI not structured around routing, context policy, and human validation
- No auth flow screen or onboarding path
- Project and space pages do not yet reflect real PO workflows

## Priority choices implemented in this iteration

1. Move the app to a clear, light, productivity-first design system
2. Restructure the shell and key screens around Project > Space > Topic
3. Add missing critical entry screens: login, onboarding, topic
4. Introduce a first Shadow Core backend shape for routing and context transparency

## Remaining priorities after this iteration

1. Persist data and wire frontend to API
2. Add CRUD flows for projects, spaces, topics, tickets, and documents
3. Add command palette and keyboard shortcuts
4. Add document tree and rich editor
5. Add import job UI and audit trail
