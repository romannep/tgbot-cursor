import Database from 'better-sqlite3';

export type MessageDirection = 'in' | 'out';

export interface LoggedMessage {
	id: number;
	direction: MessageDirection;
	chat_id: number | null;
	user_id: number | null;
	message_id: number | null;
	text: string | null;
	raw_json: string;
	created_at: string;
}

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
	if (dbInstance) return dbInstance;
	const databasePath = process.env.DATABASE_PATH || 'data/bot.sqlite';
	dbInstance = new Database(databasePath);
	dbInstance.pragma('journal_mode = WAL');
	ensureSchema(dbInstance);
	return dbInstance;
}

function ensureSchema(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			direction TEXT NOT NULL CHECK (direction IN ('in','out')),
			chat_id INTEGER,
			user_id INTEGER,
			message_id INTEGER,
			text TEXT,
			raw_json TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT (datetime('now'))
		);
		CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
		CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
	`);
}

const insertStatement = () => getDatabase().prepare(
	`INSERT INTO messages (direction, chat_id, user_id, message_id, text, raw_json)
	 VALUES (@direction, @chat_id, @user_id, @message_id, @text, @raw_json)`
);

export function logMessage(params: {
	direction: MessageDirection;
	chatId?: number | null;
	userId?: number | null;
	messageId?: number | null;
	text?: string | null;
	raw: unknown;
}): void {
	try {
		const row = {
			direction: params.direction,
			chat_id: params.chatId ?? null,
			user_id: params.userId ?? null,
			message_id: params.messageId ?? null,
			text: params.text ?? null,
			raw_json: JSON.stringify(params.raw)
		};
		insertStatement().run(row);
	} catch (error) {
		// Avoid throwing inside bot handlers; just log
		console.error('Failed to log message to SQLite:', error);
	}
}


