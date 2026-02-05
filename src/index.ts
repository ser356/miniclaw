import { config, validateConfig } from './config.js';
import { bot } from './bot.js';
import { healthCheck } from './llm.js';

async function main() {
  console.log('🦞 MiniClaw - Starting...\n');
  
  // Validate config
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Config error:', (error as Error).message);
    process.exit(1);
  }
  
  // Check LM Studio connection
  console.log(`📡 Connecting to LM Studio at ${config.lmStudio.baseURL}`);
  const llmOk = await healthCheck();
  
  if (!llmOk) {
    console.warn('⚠️  LM Studio not responding. Make sure it\'s running with the API server enabled.');
    console.warn(`   Model: ${config.lmStudio.model}\n`);
  } else {
    console.log(`✅ LM Studio connected`);
    console.log(`   Model: ${config.lmStudio.model}\n`);
  }
  
  // Start bot
  console.log('🤖 Starting Telegram bot...');
  
  bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Bot started: @${botInfo.username}`);
      console.log('\n📱 Send /start to your bot on Telegram\n');
      
      if (config.telegram.allowedUsers.length > 0) {
        console.log(`🔒 Allowed users: ${config.telegram.allowedUsers.join(', ')}`);
      } else {
        console.log('🔓 No user whitelist - anyone can use the bot');
      }
      console.log('');
    },
  });
  
  // Graceful shutdown
  const shutdown = () => {
    console.log('\n👋 Shutting down...');
    bot.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
