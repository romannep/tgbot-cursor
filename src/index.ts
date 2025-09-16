import { Telegraf, Context } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  console.error('BOT_TOKEN is not set. Please define it in .env');
  process.exit(1);
}

const bot = new Telegraf<Context>(botToken);

bot.command('start', async (ctx) => {
  const name = ctx.from?.first_name ?? 'there';
  await ctx.reply(`Hello, ${name}! I am alive and ready.`);
});

bot.command('health', async (ctx) => {
  await ctx.reply('OK');
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  await ctx.reply(`Echo: ${text}`);
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

async function launch(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  await bot.launch();
  console.log('Bot launched');

  if (!isProduction) {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.once(signal, async () => {
        console.log(`Received ${signal}, stopping bot...`);
        await bot.stop(signal);
        process.exit(0);
      });
    }
  }
}

launch().catch((e) => {
  console.error('Failed to launch bot:', e);
  process.exit(1);
});
