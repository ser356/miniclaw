# Calabacilla — Convenciones

> Guía para trabajar en el código de Calabacilla.

## Filosofía

**Mínimo viable.** Si no es necesario, no lo añadas.

**Local first.** Todo corre en la máquina del usuario. Sin excepciones.

**Privacidad por defecto.** Nada sale. Nunca.

## Stack (no negociable)

- Node 20+
- TypeScript strict
- pnpm
- grammy (Telegram)
- openai SDK (para LM Studio)
- dotenv

**3 dependencias runtime.** Mantenerlo así.

## Estructura

```
src/
├── index.ts     # Entry point, health check, graceful shutdown
├── config.ts    # Env vars, validación
├── bot.ts       # Comandos, handlers, split de mensajes
├── llm.ts       # Cliente LLM, system prompt, chat()
└── sessions.ts  # Memoria en RAM por chat
```

## UI

- **Idioma:** Español
- **Tono:** Directo, sin florituras
- **Mensajes de error:** Claros y útiles

## Commits

Mensajes cortos, en español o inglés. Sin emojis obligatorios.

```
feat: añadir comando /status
fix: corregir split de mensajes largos
```

## Testing

Por ahora manual. Si crece, añadir vitest.

## Regla de oro

Antes de añadir algo, pregunta: ¿Calabacilla lo necesita para ser útil?

Si la respuesta es no, no lo añadas.
