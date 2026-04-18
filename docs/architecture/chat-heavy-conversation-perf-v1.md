# Let’s Chat Heavy Conversation Perf V1

## Cause racine exacte

Le freeze front sur une très grosse discussion venait d’un cumul de coûts sur le même tour d’ouverture :

1. ouverture d’une conversation avec trop de messages chargés d’un coup
2. rendu immédiat de tous les messages chargés
3. parsing markdown lourd au premier affichage de chaque réponse assistant
4. rerender global de la liste quand un état local du chat change
5. payloads techniques lourds encore coûteux à sérialiser quand on ouvre certains panneaux

Le point le plus visible n’était pas un crash API. C’était un coût CPU front trop élevé à l’ouverture.

## Correctifs structurels appliqués

### Chargement incrémental

- ouverture d’une discussion : chargement des `10` derniers messages
- chargement des anciens messages uniquement à la demande via `Voir 10 messages précédents`
- backend paginé conservé comme source de vérité

### Heavy conversation safe mode

Seuils front :

- `HEAVY_CONVERSATION_MESSAGE_THRESHOLD = 20`
- `HEAVY_CONVERSATION_PAYLOAD_THRESHOLD = 28000 chars`
- `HEAVY_MESSAGE_CHAR_THRESHOLD = 2500 chars`
- `HEAVY_DEBUG_CHAR_THRESHOLD = 4000 chars`

Quand le mode lourd est activé :

- les messages assistants lourds sont affichés d’abord en aperçu compact
- le markdown complet n’est rendu qu’après clic explicite
- les blocs JSON techniques restent repliés

### Réduction des rerenders

- `UserBubble` mémoisé
- `AssistantCard` mémoisé avec comparateur
- `GeneratedObjectCard` mémoisé
- callback d’exécution d’action stabilisé
- métriques de rerender échantillonnées via `requestAnimationFrame`

### Contenu technique différé

- réponse brute LLM : panneau replié par défaut
- artefacts JSON : sérialisation différée à l’ouverture
- contenu assistant lourd : parsing markdown différé

## Instrumentation ajoutée

Visible dans le panneau debug :

- `loadedMessages`
- `renderedMessages`
- `totalPayloadChars`
- `largestMessageChars`
- `openDurationMs`
- `initialRenderMs`
- `deferredHeavyBlocks`
- top `messageRenderCounts`

## Effet attendu

Avant :

- ouverture d’une grosse conversation = charge CPU front immédiate
- parsing markdown et rendu complet dès le premier affichage

Après :

- ouverture bornée au dernier lot de `10`
- contenu lourd différé
- rendu initial compact
- traçabilité locale des métriques de perf

## Limites restantes honnêtes

- la liste de messages n’utilise pas encore une librairie de virtualisation dédiée
- les métriques de perf sont mesurées côté navigateur, pas côté test automatisé
- les conversations déjà ouvertes puis massivement déroulées peuvent encore coûter plus cher, mais de manière progressive et contrôlée
