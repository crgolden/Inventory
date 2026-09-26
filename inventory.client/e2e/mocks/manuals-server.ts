import { constants } from 'node:http2';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { CHATS_PATH, JSON_CONTENT_TYPE, SseFraming } from '../../src/products/manual-chat/chat-api.ts';
import { ChatRoles, type Chat as ChatSummary, type ChatHistoryMessage } from '../../src/products/manual-chat/chat.model.ts';
import { CONTENT_TYPE_HEADER, HttpMethods } from '../../src/app/http-headers.ts';
import { portArgument } from './mock-dependencies.ts';
import { NodeBufferEncodings } from './node-constants.ts';
import { SseConstants } from './sse-constants.ts';

const PORT = portArgument();
const CHAT_KEY = /^\/chats\/([^/]+)$/;
const CHAT_MESSAGES = /^\/chats\/([^/]+)\/messages$/;
const CHAT_STREAM = /^\/chats\/([^/]+)\/messages\/stream$/;

interface MessageRequest {
  input: string;
}

interface Chat extends ChatSummary {
  readonly messages: ChatHistoryMessage[];
}

const chats = new Map<string, Chat>();

async function readJson<T>(request: IncomingMessage): Promise<Partial<T>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return chunks.length === 0 ? {} : (JSON.parse(Buffer.concat(chunks).toString(NodeBufferEncodings.utf8)) as Partial<T>);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE });
  response.end(JSON.stringify(body));
}

function sendStatus(response: ServerResponse, status: number): void {
  response.writeHead(status);
  response.end();
}

function summary(chat: Chat): ChatSummary {
  return { chatId: chat.chatId, title: chat.title, createdAt: chat.createdAt };
}

function replyTo(input: string): string {
  return `Mock manual for ${input}: ${randomUUID()}`;
}

function sseEvent(data: string): string {
  return `${SseFraming.dataPrefix}${data}${SseConstants.eventTerminator}`;
}

async function appendExchange(request: IncomingMessage, chat: Chat): Promise<string> {
  const input = (await readJson<MessageRequest>(request)).input ?? randomUUID();
  const reply = replyTo(input);
  chat.messages.push({ role: ChatRoles.user, text: input }, { role: ChatRoles.assistant, text: reply });
  chat.title ??= input;
  return reply;
}

async function stream(request: IncomingMessage, response: ServerResponse, chat: Chat): Promise<void> {
  const reply = await appendExchange(request, chat);
  response.writeHead(constants.HTTP_STATUS_OK, { [CONTENT_TYPE_HEADER]: SseConstants.contentType });
  response.write(sseEvent(JSON.stringify({ delta: { content: reply } })));
  response.end(sseEvent(SseFraming.done));
}

async function patchTitle(request: IncomingMessage, response: ServerResponse, chat: Chat): Promise<void> {
  chat.title = (await readJson<ChatSummary>(request)).title ?? chat.title;
  sendStatus(response, constants.HTTP_STATUS_NO_CONTENT);
}

createServer((request, response) => {
  const path = new URL(request.url ?? '/', `http://localhost:${PORT}`).pathname;
  const chatId = CHAT_KEY.exec(path)?.[1] ?? CHAT_MESSAGES.exec(path)?.[1] ?? CHAT_STREAM.exec(path)?.[1];
  const chat = chatId === undefined ? undefined : chats.get(chatId);
  if (path === CHATS_PATH && request.method === HttpMethods.post) {
    const created: Chat = { chatId: randomUUID(), title: null, createdAt: Date.now(), messages: [] };
    chats.set(created.chatId, created);
    sendJson(response, constants.HTTP_STATUS_CREATED, summary(created));
  } else if (path === CHATS_PATH && request.method === HttpMethods.get) {
    sendJson(response, constants.HTTP_STATUS_OK, [...chats.values()].map(summary));
  } else if (chat === undefined) {
    sendStatus(response, constants.HTTP_STATUS_NOT_FOUND);
  } else if (CHAT_KEY.test(path) && request.method === HttpMethods.get) {
    sendJson(response, constants.HTTP_STATUS_OK, summary(chat));
  } else if (CHAT_KEY.test(path) && request.method === HttpMethods.patch) {
    void patchTitle(request, response, chat);
  } else if (CHAT_KEY.test(path) && request.method === HttpMethods.delete) {
    chats.delete(chat.chatId);
    sendStatus(response, constants.HTTP_STATUS_NO_CONTENT);
  } else if (CHAT_MESSAGES.test(path) && request.method === HttpMethods.get) {
    sendJson(response, constants.HTTP_STATUS_OK, chat.messages);
  } else if (CHAT_MESSAGES.test(path) && request.method === HttpMethods.post) {
    void appendExchange(request, chat).then(reply => sendJson(response, constants.HTTP_STATUS_OK, { output: reply, chatId: chat.chatId }));
  } else if (CHAT_STREAM.test(path) && request.method === HttpMethods.post) {
    void stream(request, response, chat);
  } else {
    sendStatus(response, constants.HTTP_STATUS_NOT_FOUND);
  }
}).listen(PORT);
