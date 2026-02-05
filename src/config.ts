import 'dotenv/config';

export const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedUsers: process.env.ALLOWED_USERS
      ? process.env.ALLOWED_USERS.split(',').map(id => parseInt(id.trim()))
      : [],
  },
  lmStudio: {
    baseURL: process.env.LM_STUDIO_URL || 'http://localhost:1234/v1',
    model: process.env.LM_STUDIO_MODEL || 'mistralai/ministral-3-14b-reasoning',
    maxTokens: parseInt(process.env.MAX_TOKENS || '4096'),
  },
} as const;

export function validateConfig(): void {
  if (!config.telegram.token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }
}
