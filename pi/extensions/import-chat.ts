import type { AssistantMessage, UserMessage } from "@earendil-works/pi-ai";
import { SessionManager, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

const INDEX_PATH = join(homedir(), ".pi", "agent", "import-chat-index.json");
const MARKER = "external-chat-import";
const ZERO_USAGE = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

type Source = "codex" | "claude";
type ImportedMessage = {
	role: "user" | "assistant";
	text: string;
	timestamp: number;
	model?: string;
};
type ParsedChat = {
	cwd?: string;
	title?: string;
	messages: ImportedMessage[];
};
type SourceFile = {
	source: Source;
	path: string;
	mtimeMs: number;
	size: number;
};
type IndexEntry = {
	target: string;
	count: number;
	digest: string;
	mtimeMs: number;
	size: number;
};
type ImportIndex = Record<string, IndexEntry>;
type JsonObject = Record<string, unknown>;
type SyncResult = {
	imported: number;
	updated: number;
	skipped: number;
	ignored: number;
	failed: number;
	total: number;
};

const asObject = (value: unknown): JsonObject | undefined =>
	typeof value === "object" && value !== null ? (value as JsonObject) : undefined;

const cleanText = (value: unknown): string =>
	typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";

const timestampOf = (value: unknown): number => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return Date.now();
};

function textBlocks(content: unknown, kinds: readonly string[]): string {
	if (typeof content === "string") return cleanText(content);
	if (!Array.isArray(content)) return "";
	return content
		.flatMap((item): string[] => {
			const block = asObject(item);
			if (!block || typeof block.type !== "string" || !kinds.includes(block.type)) return [];
			const text = cleanText(block.text);
			return text ? [text] : [];
		})
		.join("\n")
		.trim();
}

function compactMessages(messages: ImportedMessage[]): ImportedMessage[] {
	const result: ImportedMessage[] = [];
	for (const message of messages) {
		if (!message.text) continue;
		const previous = result.at(-1);
		if (previous?.role === message.role) {
			previous.text += `\n\n${message.text}`;
			previous.timestamp = Math.max(previous.timestamp, message.timestamp);
			previous.model = message.model ?? previous.model;
		} else {
			result.push({ ...message });
		}
	}
	return result;
}

async function findFiles(root: string, source: Source): Promise<SourceFile[]> {
	const paths: string[] = [];
	const walk = async (directory: string): Promise<void> => {
		let entries;
		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch {
			return;
		}
		await Promise.all(
			entries.map(async (entry) => {
				const path = join(directory, entry.name);
				if (entry.isDirectory()) {
					if (source !== "claude" || entry.name !== "subagents") await walk(path);
				} else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
					paths.push(path);
				}
			}),
		);
	};
	await walk(root);
	const files = await Promise.all(
		paths.map(async (path): Promise<SourceFile | undefined> => {
			try {
				const details = await stat(path);
				return { source, path, mtimeMs: details.mtimeMs, size: details.size };
			} catch {
				return undefined;
			}
		}),
	);
	return files.filter((file): file is SourceFile => Boolean(file));
}

async function parseCodex(path: string): Promise<ParsedChat> {
	const events: ImportedMessage[] = [];
	const fallback: ImportedMessage[] = [];
	let cwd: string | undefined;
	let model = "codex";
	const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
	for await (const line of lines) {
		let record: JsonObject;
		try {
			record = JSON.parse(line) as JsonObject;
		} catch {
			continue;
		}
		const payload = asObject(record.payload);
		if (!payload) continue;
		const timestamp = timestampOf(record.timestamp);
		if (record.type === "session_meta" && typeof payload.cwd === "string") cwd = payload.cwd;
		if (record.type === "event_msg") {
			if (payload.type === "thread_settings_applied") {
				const settings = asObject(payload.thread_settings);
				if (typeof settings?.model === "string") model = settings.model;
			} else if (payload.type === "user_message") {
				const text = cleanText(payload.message);
				if (text) events.push({ role: "user", text, timestamp });
			} else if (payload.type === "agent_message") {
				const text = cleanText(payload.message);
				if (text) events.push({ role: "assistant", text, timestamp, model });
			}
		} else if (record.type === "response_item" && payload.type === "message") {
			const role = payload.role;
			if (role !== "user" && role !== "assistant") continue;
			const text = textBlocks(payload.content, role === "user" ? ["input_text"] : ["output_text"]);
			if (text) fallback.push({ role, text, timestamp, model: role === "assistant" ? model : undefined });
		}
	}
	const messages = compactMessages(events.length > 0 ? events : fallback);
	return { cwd, messages };
}

async function parseClaude(path: string): Promise<ParsedChat> {
	const records = new Map<string, JsonObject>();
	let leafId: string | undefined;
	let cwd: string | undefined;
	let title: string | undefined;
	const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
	for await (const line of lines) {
		let record: JsonObject;
		try {
			record = JSON.parse(line) as JsonObject;
		} catch {
			continue;
		}
		if (!cwd && typeof record.cwd === "string") cwd = record.cwd;
		if (record.type === "ai-title" && typeof record.aiTitle === "string") title = cleanText(record.aiTitle);
		if ((record.type === "user" || record.type === "assistant") && typeof record.uuid === "string") {
			records.set(record.uuid, record);
			leafId = record.uuid;
		}
	}

	const branch: JsonObject[] = [];
	const visited = new Set<string>();
	while (leafId && !visited.has(leafId)) {
		visited.add(leafId);
		const record = records.get(leafId);
		if (!record) break;
		branch.push(record);
		leafId = typeof record.parentUuid === "string" ? record.parentUuid : undefined;
	}
	branch.reverse();

	const messages: ImportedMessage[] = [];
	for (const record of branch) {
		if (record.isMeta === true || record.isSidechain === true) continue;
		const message = asObject(record.message);
		const role = message?.role;
		if (!message || (role !== "user" && role !== "assistant")) continue;
		const text = textBlocks(message.content, ["text"]);
		if (!text) continue;
		messages.push({
			role,
			text,
			timestamp: timestampOf(record.timestamp),
			model: role === "assistant" && typeof message.model === "string" ? message.model : undefined,
		});
	}
	return { cwd, title, messages: compactMessages(messages) };
}

const digestMessages = (messages: ImportedMessage[]): string => {
	const hash = createHash("sha256");
	for (const message of messages) hash.update(message.role).update("\0").update(message.text).update("\0");
	return hash.digest("hex");
};

const sessionName = (chat: ParsedChat): string => {
	const firstUser = chat.messages.find((message) => message.role === "user")?.text;
	const raw = chat.title || firstUser || "Imported chat";
	const firstLine = raw.split(/\r?\n/, 1)[0]?.replace(/\s+/g, " ").trim() || "Imported chat";
	const characters = Array.from(firstLine);
	return characters.length > 60 ? `${characters.slice(0, 59).join("")}…` : firstLine;
};

function appendMessages(manager: SessionManager, messages: ImportedMessage[], source: Source): void {
	for (const imported of messages) {
		if (imported.role === "user") {
			const message: UserMessage = { role: "user", content: imported.text, timestamp: imported.timestamp };
			manager.appendMessage(message);
		} else {
			const message: AssistantMessage = {
				role: "assistant",
				content: [{ type: "text", text: imported.text }],
				api: source === "codex" ? "openai-codex-responses" : "anthropic-messages",
				provider: source === "codex" ? "openai-codex" : "anthropic",
				model: imported.model ?? source,
				usage: ZERO_USAGE,
				stopReason: "stop",
				timestamp: imported.timestamp,
			};
			manager.appendMessage(message);
		}
	}
}

async function loadIndex(): Promise<ImportIndex> {
	try {
		return JSON.parse(await readFile(INDEX_PATH, "utf8")) as ImportIndex;
	} catch {
		return {};
	}
}

async function saveIndex(index: ImportIndex): Promise<void> {
	await mkdir(join(homedir(), ".pi", "agent"), { recursive: true });
	await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

async function ensurePersisted(manager: SessionManager): Promise<string> {
	const target = manager.getSessionFile();
	if (!target) throw new Error("pi did not create a persistent session");
	if (!existsSync(target)) {
		const header = manager.getHeader();
		if (!header) throw new Error("pi did not create a session header");
		await mkdir(dirname(target), { recursive: true });
		const lines = [header, ...manager.getEntries()].map((entry) => JSON.stringify(entry)).join("\n");
		await writeFile(target, `${lines}\n`, "utf8");
	}
	return target;
}

export async function syncExternalChats(
	fallbackCwd: string,
	onProgress?: (completed: number, total: number) => void,
): Promise<SyncResult> {
	const [codexFiles, claudeFiles] = await Promise.all([
		findFiles(join(homedir(), ".codex", "sessions"), "codex"),
		findFiles(join(homedir(), ".claude", "projects"), "claude"),
	]);
	const files = [...codexFiles, ...claudeFiles].sort((a, b) => a.mtimeMs - b.mtimeMs);
	const index = await loadIndex();
	const result: SyncResult = {
		imported: 0,
		updated: 0,
		skipped: 0,
		ignored: 0,
		failed: 0,
		total: files.length,
	};

	for (let position = 0; position < files.length; position++) {
		const file = files[position];
		const key = `${file.source}:${file.path}`;
		const existing = index[key];
		if (
			existing &&
			existing.mtimeMs === file.mtimeMs &&
			existing.size === file.size &&
			existsSync(existing.target)
		) {
			result.skipped++;
			onProgress?.(position + 1, files.length);
			continue;
		}

		try {
			const chat = file.source === "codex" ? await parseCodex(file.path) : await parseClaude(file.path);
			if (!chat.messages.some((message) => message.role === "user")) {
				result.ignored++;
				onProgress?.(position + 1, files.length);
				continue;
			}

			if (existing && existsSync(existing.target)) {
				const importedPrefix = chat.messages.slice(0, existing.count);
				if (chat.messages.length < existing.count || digestMessages(importedPrefix) !== existing.digest) {
					throw new Error("source history changed and cannot be appended safely");
				}
				const manager = SessionManager.open(existing.target);
				appendMessages(manager, chat.messages.slice(existing.count), file.source);
				manager.appendCustomEntry(MARKER, { source: file.source, path: file.path, count: chat.messages.length });
				index[key] = {
					...existing,
					count: chat.messages.length,
					digest: digestMessages(chat.messages),
					mtimeMs: file.mtimeMs,
					size: file.size,
				};
				result.updated++;
			} else {
				const manager = SessionManager.create(chat.cwd || fallbackCwd);
				appendMessages(manager, chat.messages, file.source);
				manager.appendSessionInfo(sessionName(chat));
				manager.appendCustomEntry(MARKER, { source: file.source, path: file.path, count: chat.messages.length });
				const target = await ensurePersisted(manager);
				index[key] = {
					target,
					count: chat.messages.length,
					digest: digestMessages(chat.messages),
					mtimeMs: file.mtimeMs,
					size: file.size,
				};
				result.imported++;
			}
		} catch {
			result.failed++;
		}
		onProgress?.(position + 1, files.length);
		if ((position + 1) % 10 === 0) await saveIndex(index);
	}
	await saveIndex(index);
	return result;
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("import-chats", {
		description: "Sync all Codex CLI and Claude Code chats into pi session folders",
		handler: async (_args, ctx) => {
			await ctx.waitForIdle();
			if (ctx.hasUI) {
				const confirmed = await ctx.ui.confirm(
					"Import external chats",
					"Sync every Codex CLI and Claude Code conversation into its matching pi project folder?",
				);
				if (!confirmed) return;
			}

			ctx.ui.notify("Syncing Codex CLI and Claude Code conversations...", "info");
			try {
				const result = await syncExternalChats(ctx.cwd, (completed, total) => {
					ctx.ui.setStatus("chat-import", `syncing chats: ${completed}/${total}`);
				});
				ctx.ui.setStatus("chat-import", undefined);
				ctx.ui.notify(
					`Chat sync complete: ${result.imported} imported, ${result.updated} updated, ${result.skipped} unchanged, ${result.ignored} empty logs ignored, ${result.failed} failed`,
					result.failed > 0 ? "warning" : "info",
				);
			} catch (error) {
				ctx.ui.setStatus("chat-import", undefined);
				const detail = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Chat sync failed: ${detail}`, "error");
			}
		},
	});
}
