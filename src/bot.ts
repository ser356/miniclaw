import { Bot, Context } from 'grammy';
import { config } from './config.js';
import { chat, healthCheck } from './llm.js';
import { getSession, addMessage, clearSession, getActiveSessionCount } from './sessions.js';
import { setUserName, addFact, loadMemory, clearMemory, forgetFact } from './memory.js';

export const bot = new Bot(config.telegram.token);

// Check if user is allowed
function isAllowed(userId: number): boolean {
  if (config.telegram.allowedUsers.length === 0) {
    return true; // No whitelist = allow all
  }
  return config.telegram.allowedUsers.includes(userId);
}

// /start command
bot.command('start', async (ctx) => {
  if (!isAllowed(ctx.from?.id || 0)) {
    await ctx.reply('⛔ No autorizado');
    return;
  }

  const memory = loadMemory();
  const greeting = memory.user.name ? `Hola, ${memory.user.name}.` : 'Hola.';

  await ctx.reply(
    `🦀 *MiniClaw*\n\n${greeting}\n\n` +
    '*Comandos:*\n' +
    '`/new` — Nueva conversación\n' +
    '`/status` — Estado del sistema\n' +
    '`/iam <nombre>` — Dime tu nombre\n' +
    '`/remember <algo>` — Recordar algo\n' +
    '`/memory` — Ver qué recuerdo\n' +
    '`/forget` — Olvidar todo',
    { parse_mode: 'Markdown' }
  );
});

// /new command - reset session
bot.command('new', async (ctx) => {
  if (!isAllowed(ctx.from?.id || 0)) return;
  
  clearSession(ctx.chat.id);
  await ctx.reply('🔄 Nueva conversación iniciada');
});

// /status command
bot.command('status', async (ctx) => {
  if (!isAllowed(ctx.from?.id || 0)) return;

  const llmOk = await healthCheck();
  const sessions = getActiveSessionCount();

  await ctx.reply(
    `📊 *Estado*\n\n` +
    `• LM Studio: ${llmOk ? '✅ Online' : '❌ Offline'}\n` +
    `• Modelo: \`${config.lmStudio.model}\`\n` +
    `• Sesiones activas: ${sessions}`,
    { parse_mode: 'Markdown' }
  );
});

// /iam command - set user name
bot.command('iam', async (ctx) => {
  if (!isAllowed(ctx.from?.id || 0)) return;

  const name = ctx.message?.text?.replace('/iam', '').trim();
  if (!name) {
    await ctx.reply('Uso: `/iam Tu Nombre`', { parse_mode: 'Markdown' });
    return;
  }

  setUserName(name);
  await ctx.reply(`Guardado. Ahora sé que te llamas ${name}.`);
});

// /remember command - save a fact
bot.command('remember', async (ctx) => {
  if (!isAllowed(ctx.from?.id || 0)) return;

  const fact = ctx.message?.text?.replace('/remember', '').trim();
  if (!fact) {
    await ctx.reply('Uso: `/remember algo que quieras que recuerde`', { parse_mode: 'Markdown' });
    return;
  }

  addFact(fact);
  await ctx.reply(`Guardado: "${fact}"`);
});

// /memory command - show what I remember
bot.command('memory', async (ctx) => {
  if (!isAllowed(ctx.from?.id || 0)) return;

  const memory = loadMemory();
  const parts: string[] = [];

  if (memory.user.name) {
    parts.push(`*Tu nombre:* ${memory.user.name}`);
  }

  if (memory.facts.length > 0) {
    parts.push('*Recuerdo:*');
    memory.facts.forEach((fact, i) => {
      parts.push(`${i + 1}. ${fact}`);
    });
  }

  if (parts.length === 0) {
    await ctx.reply('No recuerdo nada todavía. Usa `/iam` o `/remember` para enseñarme.', { parse_mode: 'Markdown' });
    return;
  }

  await ctx.reply(parts.join('\n'), { parse_mode: 'Markdown' });
});

// /forget command - clear memory
bot.command('forget', async (ctx) => {
  if (!isAllowed(ctx.from?.id || 0)) return;

  clearMemory();
  await ctx.reply('Memoria borrada. Empezamos de cero.');
});

// Handle text messages
bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id || 0;
  const chatId = ctx.chat.id;
  const text = ctx.message.text;
  
  // Skip commands
  if (text.startsWith('/')) return;
  
  // Check authorization
  if (!isAllowed(userId)) {
    await ctx.reply('⛔ No autorizado');
    return;
  }
  
  // Show typing indicator
  await ctx.replyWithChatAction('typing');
  
  // Get session history and add user message
  const history = getSession(chatId);
  addMessage(chatId, { role: 'user', content: text });
  
  try {
    // Build messages for LLM
    const messages = [...history, { role: 'user' as const, content: text }];
    
    // Get response (non-streaming for simplicity)
    const response = await chat(messages);
    
    if (response) {
      // Store assistant response
      addMessage(chatId, { role: 'assistant', content: response });
      
      // Send response (split if too long for Telegram)
      await sendLongMessage(ctx, response);
    } else {
      await ctx.reply('❌ Sin respuesta del modelo');
    }
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('❌ Error al procesar tu mensaje. ¿Está LM Studio corriendo?');
  }
});

// Split long messages for Telegram (4096 char limit)
async function sendLongMessage(ctx: Context, text: string): Promise<void> {
  const MAX_LENGTH = 4000;
  
  if (text.length <= MAX_LENGTH) {
    await ctx.reply(text);
    return;
  }
  
  // Split by paragraphs first
  const chunks: string[] = [];
  let current = '';
  
  for (const line of text.split('\n')) {
    if (current.length + line.length + 1 > MAX_LENGTH) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current) chunks.push(current);
  
  // Send each chunk
  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});
