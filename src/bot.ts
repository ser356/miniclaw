import { Bot, Context } from 'grammy';
import { PDFParse } from 'pdf-parse';
import { config } from './config.js';
import { chat, healthCheck, type MessageContent } from './llm.js';
import { getSession, addMessage, clearSession, getActiveSessionCount } from './sessions.js';
import { setUserName, addFact, loadMemory, clearMemory, forgetFact } from './memory.js';

// Download image from Telegram and convert to base64
async function getImageBase64(ctx: Context, fileId: string): Promise<string> {
  const file = await ctx.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

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
    `🦀 *Calabacilla*\n\n${greeting}\n\n` +
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

// Handle photo messages (vision)
bot.on('message:photo', async (ctx) => {
  const userId = ctx.from?.id || 0;
  const chatId = ctx.chat.id;

  if (!isAllowed(userId)) {
    await ctx.reply('⛔ No autorizado');
    return;
  }

  await ctx.replyWithChatAction('typing');

  try {
    // Get highest resolution photo
    const photos = ctx.message.photo;
    const photo = photos[photos.length - 1];
    const base64 = await getImageBase64(ctx, photo.file_id);
    const caption = ctx.message.caption || 'Describe esta imagen';

    // Build multimodal content
    const content: MessageContent = [
      { type: 'text', text: caption },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
    ];

    // Get session history
    const history = getSession(chatId);
    addMessage(chatId, { role: 'user', content: `[Imagen] ${caption}` });

    // Send to LLM with image
    const messages = [...history, { role: 'user' as const, content }];
    const response = await chat(messages);

    if (response) {
      addMessage(chatId, { role: 'assistant', content: response });
      await sendLongMessage(ctx, response);
    } else {
      await ctx.reply('❌ Sin respuesta del modelo');
    }
  } catch (error) {
    console.error('Error processing image:', error);
    await ctx.reply('❌ Error al procesar la imagen. ¿Soporta visión el modelo cargado?');
  }
});

// Supported text document extensions
const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.csv', '.xml', '.html', '.css', '.js', '.ts', '.py', '.sh'];

// Download file from Telegram and get buffer
async function getFileBuffer(ctx: Context, fileId: string): Promise<Buffer> {
  const file = await ctx.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

// Extract text from document based on type
async function extractDocumentText(buffer: Buffer, fileName: string): Promise<string | null> {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));

  if (ext === '.pdf') {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }

  if (TEXT_EXTENSIONS.includes(ext)) {
    return buffer.toString('utf-8');
  }

  return null;
}

// Handle document messages
bot.on('message:document', async (ctx) => {
  const userId = ctx.from?.id || 0;
  const chatId = ctx.chat.id;

  if (!isAllowed(userId)) {
    await ctx.reply('⛔ No autorizado');
    return;
  }

  const doc = ctx.message.document;
  const fileName = doc.file_name || 'documento';
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));

  // Check if supported
  if (ext !== '.pdf' && !TEXT_EXTENSIONS.includes(ext)) {
    await ctx.reply(
      `❌ Formato no soportado: \`${ext}\`\n\n` +
      `Formatos válidos: .pdf, ${TEXT_EXTENSIONS.join(', ')}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await ctx.replyWithChatAction('typing');

  try {
    const buffer = await getFileBuffer(ctx, doc.file_id);
    const text = await extractDocumentText(buffer, fileName);

    if (!text || text.trim().length === 0) {
      await ctx.reply('❌ No pude extraer texto del documento');
      return;
    }

    const caption = ctx.message.caption || 'Resume este documento';
    const truncatedText = text.length > 15000 ? text.substring(0, 15000) + '\n\n[...truncado]' : text;
    const userMessage = `[Documento: ${fileName}]\n\n${truncatedText}\n\n---\n${caption}`;

    // Get session history
    const history = getSession(chatId);
    addMessage(chatId, { role: 'user', content: `[Documento: ${fileName}] ${caption}` });

    // Send to LLM
    const messages = [...history, { role: 'user' as const, content: userMessage }];
    const response = await chat(messages);

    if (response) {
      addMessage(chatId, { role: 'assistant', content: response });
      await sendLongMessage(ctx, response);
    } else {
      await ctx.reply('❌ Sin respuesta del modelo');
    }
  } catch (error) {
    console.error('Error processing document:', error);
    await ctx.reply('❌ Error al procesar el documento');
  }
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

// Send a message with Markdown, fallback to plain text if malformed
async function sendWithMarkdown(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch {
    // Markdown malformed, send as plain text
    await ctx.reply(text);
  }
}

// Split long messages for Telegram (4096 char limit)
async function sendLongMessage(ctx: Context, text: string): Promise<void> {
  const MAX_LENGTH = 4000;

  if (text.length <= MAX_LENGTH) {
    await sendWithMarkdown(ctx, text);
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
    await sendWithMarkdown(ctx, chunk);
  }
}

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});
