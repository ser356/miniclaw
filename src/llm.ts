import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { getMemoryContext } from './memory.js';

// LM Studio exposes OpenAI-compatible API
const client = new OpenAI({
  baseURL: config.lmStudio.baseURL,
  apiKey: 'lm-studio', // LM Studio doesn't require a real key
});

// Vision API content types
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image_url';
  image_url: { url: string };
}

export type MessageContent = string | (TextContent | ImageContent)[];

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

// Load soul from SOUL.md at startup
const __dirname = dirname(fileURLToPath(import.meta.url));
const SOUL_PATH = join(__dirname, '..', 'SOUL.md');

const FALLBACK_PROMPT = `Eres MiniClaw, un micro agente local. Directo y útil.`;

function loadSoul(): string {
  try {
    const soul = readFileSync(SOUL_PATH, 'utf-8');
    // Extract the essence - skip markdown headers for a cleaner prompt
    const lines = soul.split('\n').filter(line =>
      !line.startsWith('#') && line.trim() !== '' && !line.startsWith('*')
    );
    return lines.join('\n').trim() || FALLBACK_PROMPT;
  } catch {
    console.warn('⚠️  SOUL.md not found, using fallback prompt');
    return FALLBACK_PROMPT;
  }
}

const SYSTEM_PROMPT = loadSoul();

export async function chat(
  messages: Message[],
  onChunk?: (chunk: string) => void
): Promise<string> {
  // Build system prompt with soul + persistent memory
  const memoryContext = getMemoryContext();
  const systemContent = memoryContext
    ? `${SYSTEM_PROMPT}\n\n--- Memoria ---\n${memoryContext}`
    : SYSTEM_PROMPT;

  const fullMessages: Message[] = [
    { role: 'system', content: systemContent },
    ...messages,
  ];

  if (onChunk) {
    // Streaming mode
    const stream = await client.chat.completions.create({
      model: config.lmStudio.model,
      messages: fullMessages as any,
      max_tokens: config.lmStudio.maxTokens,
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }
    return fullResponse;
  } else {
    // Non-streaming mode
    const response = await client.chat.completions.create({
      model: config.lmStudio.model,
      messages: fullMessages as any,
      max_tokens: config.lmStudio.maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await client.models.list();
    return true;
  } catch {
    return false;
  }
}
