# ADR v1 — Runtime IA MePO

## Décisions figées

1. MePO est la source de vérité principale.
2. La hiérarchie des sources est codée en dur dans cet ordre:
   1. objets MePO injectés
   2. mémoire topic
   3. documents locaux liés topic/espace
   4. knowledge docs projet
   5. vector store OpenAI
3. Le LLM n’orchestre pas les sources. L’orchestrateur choisit les sources et le LLM synthétise.
4. Les `Skills et directives` sont une configuration runtime locale. Ils ne sont jamais synchronisés vers OpenAI.
5. Les `Connaissances projet` sont le seul corpus documentaire synchronisable.
6. Le vector store n’est jamais créé automatiquement.
7. Le vector store est toujours réutilisé via un unique champ `vectorStoreId`.
8. La synchronisation documentaire est toujours manuelle via un unique bouton `Synchroniser`.
9. Si `vectorStoreId` est vide, aucune synchronisation n’est possible.
10. Si `vectorStoreId` est invalide, la synchronisation échoue de manière bloquante et explicite.
11. Aucun fichier local MePO n’est utilisé directement comme s’il était lisible par OpenAI.
12. Le contenu documentaire est toujours extrait, normalisé et transformé en texte stable avant upload.
13. Aucune action proposée par le LLM n’est exécutée directement.
14. Toute action suit le flux: proposition → validation utilisateur → exécution MePO → confirmation.
15. Le mode `pilotage` interdit toute recherche documentaire projet.
16. Le mode `memoire` interdit toute recherche documentaire projet.
17. Le mode `redaction` s’arrête sur MePO si un ticket crédible existe déjà.
18. Les documents locaux priment toujours sur les knowledge docs projet.
19. Le vector store n’est autorisé qu’en dernier recours documentaire.
20. Aucune injection brute `full space` ou `full topic` n’est autorisée dans le prompt runtime.

## Artefacts de contrat

- `PromptRuntimeConfig`
- `SourcePriorityPolicy`
- `FeatureFlags`
- `WorkspaceContext`
- `RetrievalTrace`
- `ProposedAction` validée par politique

## Zones de décision explicites restantes

- sufficiency check purement rule-based ou rule-based + scoring
- stratégie de cache workspace et invalidation fine
- granularité de la mémoire de conversation
- règles de couverture recette multi-référentiels
