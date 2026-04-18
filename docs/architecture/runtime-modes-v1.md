# Runtime Modes V1

## Default mode

- `mepo`

## Recommended production mode

- `mepo`

## Transitional mode

- `hybrid`
- usage strict: transition controlee entre le runtime MePO et un fallback OpenAI.

## Mode to remove later

- `openai_only`
- usage strict: secours ou comparaison ponctuelle, pas voie normale.

## Coded rules

1. `mepo` reste la voie normale.
2. `hybrid` est temporaire.
3. `openai_only` n'est pas la cible architecture.
4. en cas de mode invalide, fallback securise vers `mepo`.
