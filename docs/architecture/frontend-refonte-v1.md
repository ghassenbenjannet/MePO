# MePO Frontend — Refonte Complète v1
_Lead Frontend / Product Architecture / UX Engineering_

---

## A. Audit Frontend Existant — Synthèse

### Stack actuelle
| Couche | Technologie | État |
|--------|-------------|------|
| Framework | React 18.3 | ✅ Solide |
| Build | Vite 5.4 | ✅ Solide |
| Routing | React Router 6.28 | ✅ Solide, pas de lazy |
| Data fetching | TanStack Query 5.59 | ✅ Solide |
| State | Zustand 5.0 | ✅ Solide |
| Styling | Tailwind 3.4 + CSS vars | ✅ Bon, à affiner |
| Rich text | TipTap 2.10 | ✅ Fonctionnel |
| Whiteboard | tldraw 4.2 | ⚠️ Lourd, pas isolé |
| Diagrams | Mermaid 11 | ⚠️ Lourd, pas lazy-loaded |
| Icons | Lucide React | ✅ Bien |
| Virtuel | — | ❌ Absent |
| Forms | — | ❌ Pas de lib dédiée |
| Tests | — | ❌ Absent |

### Problèmes structurels identifiés

#### Performance
- **Pas de code splitting** : toutes les pages chargées au boot (tldraw = ~800KB, mermaid = ~500KB)
- **Pas de virtualisation** : listes tickets/topics/docs chargées en entier
- **Pas de debounce** sur la recherche topbar (requête à chaque frappe)
- **Pas de memo** sur les composants coûteux (ProjectCard, TicketRow, etc.)
- **Re-renders excessifs** : state local dans les grands composants parents (space-page = 800+ lignes)

#### UX
- **Pas de skeleton loaders** : spinners génériques partout
- **Pas de command palette** : navigation lente, pas de Ctrl+K
- **Modales** : pas de gestion de z-index, pas de focus trap, pas scrollables
- **États vides** : inconsistants (certains absents)
- **Erreurs** : catch générique, pas d'error boundary
- **Formulaires** : validation minimale, pas de messages inline
- **Onboarding** : stub non-fonctionnel
- **RightDock** : hardcodé, non connecté

#### Architecture composants
- **Pages monolithiques** : dashboard-page ~600L, space-page ~800L, project-page ~900L
- **Duplication** : initials(), statusConfig(), topicColorClass() dupliqués dans plusieurs pages
- **Pas de Design System formel** : composants déclarés inline dans chaque page
- **No error boundaries** : une erreur dans un sous-composant crash toute la page

---

## B. Architecture Cible Frontend

### Arborescence cible
```
frontend/src/
├── app/
│   ├── router.tsx          # Code splitting avec React.lazy
│   ├── styles.css          # Design system tokens
│   └── providers.tsx       # QueryClient + ThemeProvider + ToastProvider
│
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx   # Layout principal
│   │   ├── sidebar.tsx     # Navigation latérale redesignée
│   │   ├── topbar.tsx      # Barre supérieure + breadcrumb + search
│   │   ├── command-palette.tsx  # Ctrl+K command palette
│   │   └── right-dock.tsx  # Panneau IA connecté
│   │
│   ├── ui/                 # Design system primitives
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx      # Modal accessible (focus trap, scroll)
│   │   ├── drawer.tsx      # Drawer latéral
│   │   ├── field.tsx       # Form fields
│   │   ├── skeleton.tsx    # Loading skeletons
│   │   ├── empty.tsx       # Empty states
│   │   ├── toast.tsx
│   │   ├── tooltip.tsx
│   │   ├── tabs.tsx
│   │   ├── dropdown.tsx
│   │   └── virtual-list.tsx  # Wrapper @tanstack/react-virtual
│   │
│   ├── auth/
│   ├── chat/
│   ├── documents/
│   ├── notifications/
│   └── project/
│
├── hooks/                  # Data hooks inchangés
├── stores/                 # Zustand stores inchangés
├── types/                  # Domain types inchangés
├── lib/
│   ├── api.ts
│   ├── utils.ts
│   └── format.ts           # Formatters partagés (initials, dates, etc.)
│
└── pages/
    ├── auth/
    ├── dashboard/
    ├── project/
    ├── space/
    ├── topic/
    ├── onboarding/
    └── settings/
```

### Stratégie de code splitting
```tsx
// Tous les éditeurs lourds en lazy
const PageEditor = lazy(() => import('../components/documents/page-editor'))
const MermaidEditor = lazy(() => import('../components/documents/mermaid-editor'))
const WhiteboardEditor = lazy(() => import('../components/documents/whiteboard-editor'))

// Toutes les pages en lazy
const DashboardPage = lazy(() => import('../pages/dashboard/dashboard-page'))
const SpacePage = lazy(() => import('../pages/space/space-page'))
// etc.
```

---

## C. Design System Cible

### Tokens sémantiques
```
Surface:  --surface-canvas | --surface-raised | --surface-overlay | --surface-sunken
Text:     --text-primary | --text-secondary | --text-tertiary | --text-inverse
Border:   --border-default | --border-strong | --border-subtle
Focus:    --focus-ring
```

### Composants design system (primitives)
- **Button**: primary / secondary / ghost / danger / icon — taille xs/sm/md/lg
- **Badge**: tones (neutral/brand/success/warning/danger/info) — variantes dot/pill
- **Card**: default / interactive / selected — avec header/body/footer
- **Dialog**: scrollable, focus trap, tailles (sm/md/lg/xl/full)
- **Skeleton**: pulse + shimmer, shapes (text/rect/circle/card)
- **Empty**: icon + title + description + action, variantes (page/section/inline)
- **Field**: label + input/textarea/select + hint + error inline
- **Tabs**: tabs + underline + pills variants
- **Dropdown**: accessible, keyboard navigation
- **Tooltip**: portal-based, positions (top/bottom/left/right)

---

## D. Cartographie des Écrans à Refondre

| Écran | Priorité | Problèmes | Actions |
|-------|----------|-----------|---------|
| **App Shell** | P0 | Layout pas optimal, sidebar lourde | Layout 2-colonnes propre, sidebar redesign |
| **Sidebar** | P0 | Navigation plate, pas de hiérarchie | Sections claires, profile en bas, espaces groupés |
| **Topbar** | P0 | Breadcrumb basique, search sans debounce | Breadcrumb contextuel, search debounce 300ms, Ctrl+K |
| **Dashboard** | P1 | Cards basiques, pas de stats utiles | Grille premium, stats réelles, quick actions |
| **Project Page** | P1 | 900 lignes, tabs mal organisés | Extraction composants, tabs plus claires |
| **Space Page** | P1 | 800 lignes, kanban stub | Découpe composants, kanban fonctionnel, meilleures listes |
| **Topic Page** | P2 | Tableau tickets basique | Layout ticket enrichi, status board |
| **Login** | P3 | Fonctionnel mais basique | Design premium |
| **Profile** | P3 | Long formulaire | Sections séparées, meilleure UX |
| **Settings** | P3 | Read-only | Rendre actionnables |

---

## E. Stratégie de Migration sans Régression

### Principes
1. **Aucune fonctionnalité supprimée** — tout est porté
2. **Migration composant par composant** — pas de réécriture globale en une passe
3. **Backward compatibility** — les hooks/stores ne changent pas
4. **Feature flags** — pas nécessaires pour une migration UI

### Tranches de livraison

**Tranche 1 — Fondations (cette session)**
- Package.json : ajout @tanstack/react-virtual
- Design system : tokens + composants primitifs
- Router : code splitting (React.lazy)
- App Shell : layout + sidebar + topbar redesigns
- lib/format.ts : utilitaires partagés
- Skeleton loaders : skeletons génériques
- Command palette : Ctrl+K navigation

**Tranche 2 — Écrans Core**
- Dashboard complet redesign
- Project page : extraction composants, tabs propres
- Space page : découpe, kanban, listes virtualisées

**Tranche 3 — Features & Polish**
- Topic page redesign
- Documents tab améliorations
- Formulaires avec validation
- Error boundaries
- Onboarding fonctionnel

**Tranche 4 — Performance**
- Virtual lists partout (tickets, topics, docs)
- Lazy loading Mermaid/Whiteboard
- Memo sur composants coûteux
- Optimistic updates pour les mutations rapides

---

## F. Stratégie Performance

### Problèmes actuels et solutions

| Problème | Impact | Solution |
|----------|--------|---------|
| tldraw chargé au boot | +800KB parse | `React.lazy` + `Suspense` |
| Mermaid chargé au boot | +500KB parse | `React.lazy` + `Suspense` |
| Lists non virtualisées | Freeze sur >100 items | `@tanstack/react-virtual` |
| Search sans debounce | N requêtes/frappe | `useDebounce(300ms)` |
| Composants non memo | Re-renders inutiles | `React.memo` + `useCallback` |
| Pages monolithiques | Bundle unique large | Code splitting par route |
| Query stale time 0 | Re-fetch excessif | `staleTime` optimisé par entité |

### Budgets de performance cibles
- LCP (Largest Contentful Paint): < 1.5s
- TTI (Time to Interactive): < 2s
- JS Bundle initial: < 200KB gzipped
- Scroll 60fps sur 500 items

---

_Exécution → voir commits suivants._
