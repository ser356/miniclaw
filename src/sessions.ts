import type { Message } from './llm.js';

interface Session {
  messages: Message[];
  lastActivity: number;
}

// In-memory session store (per chat)
const sessions = new Map<number, Session>();

// Session timeout: 30 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Max messages in context
const MAX_CONTEXT_MESSAGES = 20;

export function getSession(chatId: number): Message[] {
  const session = sessions.get(chatId);
  
  if (!session) {
    return [];
  }
  
  // Check if session expired
  if (Date.now() - session.lastActivity > SESSION_TIMEOUT) {
    sessions.delete(chatId);
    return [];
  }
  
  return session.messages;
}

export function addMessage(chatId: number, message: Message): void {
  let session = sessions.get(chatId);
  
  if (!session) {
    session = { messages: [], lastActivity: Date.now() };
    sessions.set(chatId, session);
  }
  
  session.messages.push(message);
  session.lastActivity = Date.now();
  
  // Trim old messages if too many
  if (session.messages.length > MAX_CONTEXT_MESSAGES) {
    session.messages = session.messages.slice(-MAX_CONTEXT_MESSAGES);
  }
}

export function clearSession(chatId: number): void {
  sessions.delete(chatId);
}

export function getActiveSessionCount(): number {
  // Clean expired sessions first
  const now = Date.now();
  for (const [chatId, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(chatId);
    }
  }
  return sessions.size;
}
