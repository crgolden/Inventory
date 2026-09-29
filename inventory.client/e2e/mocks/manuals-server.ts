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

type ChatHandler = (request: IncomingMessage, response: ServerResponse, chat: Chat) => void;

const CHAT_ROUTES: readonly (readonly [RegExp, string, ChatHandler])[] = [
  [CHAT_KEY, HttpMethods.get, (_request, response, chat) => sendJson(response, constants.HTTP_STATUS_OK, summary(chat))],
  [CHAT_KEY, HttpMethods.patch, (request, response, chat) => void patchTitle(request, response, chat)],
  [CHAT_KEY, HttpMethods.delete, (_request, response, chat) => {
    chats.delete(chat.chatId);
    sendStatus(response, constants.HTTP_STATUS_NO_CONTENT);
  }],
  [CHAT_MESSAGES, HttpMethods.get, (_request, response, chat) => sendJson(response, constants.HTTP_STATUS_OK, chat.messages)],
  [CHAT_MESSAGES, HttpMethods.post, (request, response, chat) =>
    void appendExchange(request, chat).then(reply => sendJson(response, constants.HTTP_STATUS_OK, { output: reply, chatId: chat.chatId }))],
  [CHAT_STREAM, HttpMethods.post, (request, response, chat) => void stream(request, response, chat)],
];

function routeChats(request: IncomingMessage, response: ServerResponse): void {
  if (request.method === HttpMethods.post) {
    const created: Chat = { chatId: randomUUID(), title: null, createdAt: Date.now(), messages: [] };
    chats.set(created.chatId, created);
    sendJson(response, constants.HTTP_STATUS_CREATED, summary(created));
  } else if (request.method === HttpMethods.get) {
    sendJson(response, constants.HTTP_STATUS_OK, [...chats.values()].map(summary));
  } else {
    sendStatus(response, constants.HTTP_STATUS_NOT_FOUND);
  }
}

createServer((request, response) => {
  const path = new URL(request.url ?? '/', `http://localhost:${PORT}`).pathname;
  if (path === CHATS_PATH) {
    routeChats(request, response);
    return;
  }
  const chatId = CHAT_KEY.exec(path)?.[1] ?? CHAT_MESSAGES.exec(path)?.[1] ?? CHAT_STREAM.exec(path)?.[1];
  const chat = chatId === undefined ? undefined : chats.get(chatId);
  const route = CHAT_ROUTES.find(([pattern, method]) => pattern.test(path) && request.method === method);
  if (chat === undefined || route === undefined) {
    sendStatus(response, constants.HTTP_STATUS_NOT_FOUND);
    return;
  }
  route[2](request, response, chat);
}).listen(PORT);
