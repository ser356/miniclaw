import { Bot, Context } from 'grammy';
import { config } from './config.js';
import { chat, healthCheck } from './llm.js';
import { getSession, addMessage, clearSession, getActiveSessionCount } from './sessions.js';

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
  
  await ctx.reply(
    '🤖 *MiniClaw* - Asistente IA Local\n\n' +
    'Comandos:\n' +
    '• `/new` - Nueva conversación\n' +
    '• `/status` - Estado del sistema\n\n' +
    'Escríbeme lo que necesites.',
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
