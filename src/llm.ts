import OpenAI from 'openai';
import { config } from './config.js';

// LM Studio exposes OpenAI-compatible API
const client = new OpenAI({
  baseURL: config.lmStudio.baseURL,
  apiKey: 'lm-studio', // LM Studio doesn't require a real key
});

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Minimal system prompt for reasoning model
const SYSTEM_PROMPT = `You are a helpful assistant. Be concise and direct.`;

export async function chat(
  messages: Message[],
  onChunk?: (chunk: string) => void
): Promise<string> {
  const fullMessages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  if (onChunk) {
    // Streaming mode
    const stream = await client.chat.completions.create({
      model: config.lmStudio.model,
      messages: fullMessages,
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
      messages: fullMessages,
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
