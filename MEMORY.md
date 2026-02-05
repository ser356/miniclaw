# Calabacilla — Memory

Calabacilla tiene dos tipos de memoria:

## Memoria de sesión (temporal)

Contexto de la conversación actual:

- Máximo 20 mensajes de historial
- Timeout de 30 minutos de inactividad
- Se borra con `/new` o al reiniciar

## Memoria persistente (permanente)

Datos que sobreviven reinicios:

- Tu nombre
- Cosas que le pidas recordar
- Guardado en `data/memory.json` (no se sube a git)

## Comandos

| Comando | Qué hace |
|---------|----------|
| `/iam Sergio` | Guardar tu nombre |
| `/remember tengo un gato` | Guardar un hecho |
| `/memory` | Ver qué recuerda |
| `/forget` | Borrar toda la memoria persistente |
| `/new` | Borrar solo la conversación actual |

## Cómo funciona

1. Al iniciar, Calabacilla lee `SOUL.md` (su personalidad)
2. También lee `data/memory.json` (lo que recuerda de ti)
3. Ambos se incluyen en el system prompt
4. Cada respuesta tiene contexto de quién eres

## Privacidad

Todo se guarda en tu máquina:

- `data/memory.json` está en `.gitignore`
- Nada se envía a servidores externos
- Puedes borrar el archivo manualmente cuando quieras
