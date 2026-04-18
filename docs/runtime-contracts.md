# Runtime Contracts

## SourcePriorityPolicy

1. `mepo_objects`
2. `topic_memory`
3. `local_documents`
4. `knowledge_documents`
5. `vector_store`

Ordre strict. Non inversable.

## FeatureFlags

- `allow_raw_workspace_dump = false`
- `allow_unplanned_document_search = false`
- `allow_automatic_action_execution = false`
- `allow_vector_store_auto_create = false`
- `allow_full_space_prompt_injection = false`

## Mode Matrix

| Mode | Sources autorisées | Sources interdites | Règle d’arrêt |
| --- | --- | --- | --- |
| `cadrage` | MePO, mémoire, docs locales, knowledge docs, vector store | aucune | stop dès que les sources locales suffisent |
| `impact` | MePO, mémoire, docs locales, knowledge docs, vector store | aucune | stop sur les dépendances visibles si suffisantes |
| `pilotage` | MePO, mémoire | docs locales, knowledge docs, vector store | jamais de recherche documentaire |
| `analyse_fonctionnelle` | MePO, mémoire, docs locales, knowledge docs, vector store | aucune | docs locales avant corpus projet |
| `analyse_technique` | MePO, mémoire, docs locales, knowledge docs, vector store | aucune | vector store seulement en renfort |
| `redaction` | MePO, mémoire, docs locales, knowledge docs, vector store | aucune | stop sur ticket MePO crédible si existant |
| `transformation` | MePO, mémoire, docs locales, knowledge docs, vector store | aucune | transformer d’abord à partir du contexte injecté |
| `memoire` | MePO, mémoire | docs locales, knowledge docs, vector store | jamais de recherche documentaire |

## WorkspaceContext

Le runtime reçoit un contexte structuré:

- `projectContext`
- `spaceContext`
- `activeTopic`
- `topicTickets`
- `topicMemory`
- `topicDocuments`
- `spaceDocuments`
- `knowledgeDocuments`
- `testRepositories`
- `docRegistry`
- `vectorStoreBinding`

## RetrievalTrace

Chaque réponse IA doit pouvoir expliquer:

- le `mode`
- le `final_level`
- si le vector store était autorisé
- si le vector store a été utilisé
- le détail des niveaux explorés ou ignorés
