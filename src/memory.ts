import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_PATH = join(__dirname, '..', 'data', 'memory.json');
const DATA_DIR = join(__dirname, '..', 'data');

export interface Memory {
  user: {
    name?: string;
    notes: string[];
  };
  facts: string[];
  lastUpdated: string;
}

const DEFAULT_MEMORY: Memory = {
  user: { notes: [] },
  facts: [],
  lastUpdated: new Date().toISOString(),
};

export function loadMemory(): Memory {
  try {
    if (!existsSync(MEMORY_PATH)) {
      return { ...DEFAULT_MEMORY };
    }
    const data = readFileSync(MEMORY_PATH, 'utf-8');
    return JSON.parse(data) as Memory;
  } catch {
    console.warn('⚠️  Could not load memory, starting fresh');
    return { ...DEFAULT_MEMORY };
  }
}

export function saveMemory(memory: Memory): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    memory.lastUpdated = new Date().toISOString();
    writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ Could not save memory:', err);
  }
}

export function setUserName(name: string): void {
  const memory = loadMemory();
  memory.user.name = name;
  saveMemory(memory);
}

export function addFact(fact: string): void {
  const memory = loadMemory();
  if (!memory.facts.includes(fact)) {
    memory.facts.push(fact);
    saveMemory(memory);
  }
}

export function addUserNote(note: string): void {
  const memory = loadMemory();
  if (!memory.user.notes.includes(note)) {
    memory.user.notes.push(note);
    saveMemory(memory);
  }
}

export function clearMemory(): void {
  saveMemory({ ...DEFAULT_MEMORY });
}

export function forgetFact(index: number): boolean {
  const memory = loadMemory();
  if (index >= 0 && index < memory.facts.length) {
    memory.facts.splice(index, 1);
    saveMemory(memory);
    return true;
  }
  return false;
}

export function getMemoryContext(): string {
  const memory = loadMemory();
  const parts: string[] = [];

  if (memory.user.name) {
    parts.push(`El usuario se llama ${memory.user.name}.`);
  }

  if (memory.user.notes.length > 0) {
    parts.push(`Notas sobre el usuario: ${memory.user.notes.join('. ')}`);
  }

  if (memory.facts.length > 0) {
    parts.push(`Cosas que recordar: ${memory.facts.join('. ')}`);
  }

  return parts.join('\n');
}
