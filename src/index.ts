import { Telegraf, Context } from 'telegraf';
import dotenv from 'dotenv';
import { logMessage, getDatabase } from './db.js';

dotenv.config();

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  console.error('BOT_TOKEN is not set. Please define it in .env');
  process.exit(1);
}

const bot = new Telegraf<Context>(botToken);

// Initialize database upfront
getDatabase();

// Middleware to log all incoming updates that contain messages
bot.use(async (ctx, next) => {
	const anyCtx = ctx as any;
	const hasMessage = Boolean(anyCtx.update?.message);
	if (hasMessage) {
		const message: any = anyCtx.update.message;
		logMessage({
			direction: 'in',
			chatId: message.chat?.id ?? null,
			userId: message.from?.id ?? null,
			messageId: message.message_id ?? null,
			text: message.text ?? null,
			raw: anyCtx.update,
		});
	}

	// Wrap outgoing send methods once per context
	const originalReply = ctx.reply.bind(ctx);
	(ctx as any).reply = async (...args: any[]) => {
		const result = await originalReply(...args as [any]);
		try {
			const sent = result as any;
			logMessage({
				direction: 'out',
				chatId: sent.chat?.id ?? ctx.chat?.id ?? null,
				userId: ctx.from?.id ?? null,
				messageId: sent.message_id ?? null,
				text: (args?.[0] != null ? String(args[0]) : null),
				raw: sent,
			});
		} catch (e) {
			console.error('Failed to log outgoing reply:', e);
		}
		return result;
	};

	const originalSendMessage = ctx.telegram.sendMessage.bind(ctx.telegram);
	ctx.telegram.sendMessage = async (chatId: number | string, text: string, extra?: any) => {
		const sent = await originalSendMessage(chatId as any, text as any, extra as any);
		try {
			logMessage({
				direction: 'out',
				chatId: typeof chatId === 'number' ? chatId : Number(chatId) || null,
				userId: ctx.from?.id ?? null,
				messageId: (sent as any)?.message_id ?? null,
				text,
				raw: sent,
			});
		} catch (e) {
			console.error('Failed to log outgoing sendMessage:', e);
		}
		return sent as any;
	};

	await next();
});

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
