# Chat Node Freeze Audit V1

## Cause racine exacte

Le freeze observe a l'ouverture d'un historique ne venait pas du backend.

Constats verifies :

- `OPTIONS /api/ai/conversations/{id}` et `GET /api/ai/conversations/{id}` repondaient correctement.
- PostgreSQL etait sain ; aucun symptome de blocage base ou API.
- le cas reel problematique pouvait ne contenir que `2` messages :
  - `1` message user autour de `13 856` caracteres
  - `1` message assistant autour de `2 134` caracteres
  - `metadata` assistant autour de `7 245` caracteres

La cause structurelle etait cote frontend :

1. le chat restait monte dans `SpacePage` comme un gros composant `LetsChat`
2. ce composant portait trop de responsabilites :
   - historique
   - rendu du thread
   - debug
   - actions proposees
   - instrumentation
   - derivations de state
3. a l'ouverture d'une conversation, le frontend ingerait encore des messages historiquement riches dans le thread principal
4. la page espace chargeait donc un arbre React trop lourd pour un simple affichage de thread

Conclusion :

- le freeze ne venait pas de la longueur d'historique seule
- il venait du couplage entre navigation, chargement de conversation et rendu du thread dans un composant frontend monolithique

## Correction architecturale appliquee

La correction de tranche 2.5 consiste a introduire un vrai `MePO Chat Node`.

Nouvelle chaine :

`Frontend -> Chat Node -> services IA / persistance`

Le frontend ne consomme plus le fil historique brut.
Il consomme :

- `ConversationPreview`
- `MessagePreview`
- `MessageDetail`
- `ProposedActionCard`

Le detail complet d'un message n'est charge qu'a la demande.

## Nettoyage applique

### Supprime du flux principal

- montage direct de `LetsChat` depuis `SpacePage`
- ouverture du chat comme onglet lourd dans la page espace

### Encapsule

- `frontend/src/components/chat/lets-chat.tsx` reste legacy, mais n'est plus le chemin principal

### Remplacant cible

- `frontend/src/pages/chat/chat-page.tsx`
- `backend/app/api/routes_ai_conversations.py` via endpoints `chat-node`

## Contrats exposes

### ConversationPreview

- `id`
- `title`
- `last_message_at`
- `status`
- `unread_count`
- `last_assistant_preview`

### MessagePreview

- `id`
- `role`
- `created_at`
- `preview_text`
- `is_truncated`
- `has_detail`
- `has_actions`
- `state`

### MessageDetail

- `id`
- `full_text`
- `rendered_answer`
- `certainty`
- `related_objects`
- `actions`
- `debug_available`

## Gains structurels

1. le thread principal ne monte plus les metadonnees runtime lourdes au chargement
2. les previews sont compactes et UI-safe
3. le detail complet est lazy par message
4. le chat devient une page dediee et non plus un panneau ambigu dans l'espace
5. le frontend n'a plus a parser ou conserver un gros blob conversationnel pour juste ouvrir un thread
6. la creation de conversation et le flux d'envoi ne reposent plus sur un refresh global de la page chat
7. la liste de conversations et le thread actif sont mis a jour localement, de facon incrementale

## Cause racine corrigee sur le flux live

Le freeze residuel observe apres reponse assistant ne venait plus du chargement historique seul.

La cause etait le chemin live du frontend :

- creation / reprise de conversation encore trop couplee au rendu global du chat
- mise a jour de la sidebar et du thread par reconstruisons larges plutot que par append compact
- etats derives du chat centralises dans un seul composant avec trop de responsabilites

Correction appliquee :

- `Nouvelle discussion` cree une conversation vide via `POST /api/ai/chat-node/conversations`
- la conversation est inseree immediatement dans la sidebar locale
- le thread actif est initialise sans reload lourd
- le `send` fait un append optimiste minimal puis persiste via `POST /api/ai/chat-node/conversations/{id}/messages`
- la sidebar est mise a jour localement sans invalidation large ni refresh global
- les panneaux techniques ne sont plus visibles en mode standard

## Preuves

### Backend

- les anciens endpoints continuaient deja a repondre correctement
- les nouveaux endpoints `chat-node` exposent un thread compact et un detail separe

### Tests

- `backend/tests/test_ai_conversations.py`
  - `test_chat_node_exposes_compact_previews_and_lazy_detail`
  - `test_chat_node_thread_payload_is_smaller_than_legacy_conversation_payload`

### Frontend

- `ChatPage` n'affiche que des previews au chargement initial
- le detail message est charge a la demande
- le chat n'est plus monte depuis `SpacePage`

## Mesure utile

Le test `test_chat_node_thread_payload_is_smaller_than_legacy_conversation_payload` verrouille que :

- le payload `chat-node` est strictement plus petit que le payload conversation legacy
- il reste sous `80%` de la taille du payload legacy sur un scenario lourd de reference

Cette reduction est volontairement prouvee au niveau contrat, car le probleme observe etait bien un probleme de frontend apres reception reussie de la reponse.

## Chiffres de reference

Scenario lourd de reference mesure via les routes backend :

- payload `GET /api/ai/conversations/{id}` legacy : `6422` caracteres
- payload `GET /api/ai/chat-node/conversations/{id}` thread compact : `4939` caracteres
- reduction immediate du thread monte : `1483` caracteres, soit `23.1%`
- payload `GET /api/ai/chat-node/conversations/{id}/messages/{messageId}` detail lazy assistant : `24489` caracteres

Interpretation :

- le thread principal ne porte plus le detail riche
- le detail reste disponible, mais charge explicitement et localement au message concerne
- le gain percu a l'ouverture vient du fait que le frontend ne monte plus la page espace + le thread lourd + les metadonnees riches en une seule passe
