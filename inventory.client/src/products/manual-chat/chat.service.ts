import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, type Subscriber } from 'rxjs';
import { Chat, ChatHistoryMessage, ChatResponse } from './chat.model';
import { CONTENT_TYPE_HEADER, CSRF_HEADER, CSRF_HEADER_VALUE, HttpMethods } from '../../app/http-headers';
import {
  CHATS_URL,
  chatMessagesUrl,
  chatStreamUrl,
  chatUrl,
  frameNotJsonMessage,
  frameWithoutDeltaMessage,
  JSON_CONTENT_TYPE,
  MERGE_PATCH_CONTENT_TYPE,
  SseFraming,
} from './chat-api';

interface StreamDelta {
  delta: { content: string };
}

function isStreamDelta(value: unknown): value is StreamDelta {
  if (typeof value !== 'object' || value === null || !('delta' in value)) {
    return false;
  }

  const delta = value.delta;
  return typeof delta === 'object'
    && delta !== null
    && 'content' in delta
    && typeof delta.content === 'string';
}

type StreamFrame =
  | { kind: 'content'; content: string }
  | { kind: 'done' }
  | { kind: 'failed'; message: string }
  | { kind: 'ignored' };

function readFrame(line: string): StreamFrame {
  if (!line.startsWith(SseFraming.dataPrefix)) {
    return { kind: 'ignored' };
  }
  const data = line.slice(SseFraming.dataPrefix.length).trim();
  if (data === SseFraming.done) {
    return { kind: 'done' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return { kind: 'failed', message: frameNotJsonMessage(data) };
  }
  return isStreamDelta(parsed)
    ? { kind: 'content', content: parsed.delta.content }
    : { kind: 'failed', message: frameWithoutDeltaMessage(data) };
}

function emitFramesUntilTheStreamEnds(lines: string[], subscriber: Subscriber<string>): boolean {
  for (const line of lines) {
    const frame = readFrame(line);
    if (frame.kind === 'done') {
      subscriber.complete();
      return true;
    }
    if (frame.kind === 'failed') {
      subscriber.error(new Error(frame.message));
      return true;
    }
    if (frame.kind === 'content') {
      subscriber.next(frame.content);
    }
  }
  return false;
}

async function pumpStream(body: ReadableStream<Uint8Array>, subscriber: Subscriber<string>): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pendingLine: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      subscriber.complete();
      return;
    }

    const chunk = decoder.decode(value, { stream: true });
    const lines: string[] = (pendingLine === null ? chunk : pendingLine + chunk).split('\n');
    const remainder: string | undefined = lines.pop();
    pendingLine = remainder === undefined || remainder.length === 0 ? null : remainder;

    if (emitFramesUntilTheStreamEnds(lines, subscriber)) {
      return;
    }
  }
}

@Injectable({ providedIn: 'root' })
export class ChatService {

  private readonly http = inject(HttpClient);

  getChat(chatId: string): Observable<Chat> {
    return this.http.get<Chat>(chatUrl(chatId));
  }

  createChat(): Observable<Chat> {
    return this.http.post<Chat>(CHATS_URL, {});
  }

  updateChatTitle(chatId: string, title: string): Observable<void> {
    return this.http.patch<void>(chatUrl(chatId), { title }, {
      headers: { [CONTENT_TYPE_HEADER]: MERGE_PATCH_CONTENT_TYPE },
    });
  }

  deleteChat(chatId: string): Observable<void> {
    return this.http.delete<void>(chatUrl(chatId));
  }

  getChatMessages(chatId: string): Observable<ChatHistoryMessage[]> {
    return this.http.get<ChatHistoryMessage[]>(chatMessagesUrl(chatId));
  }

  sendMessage(chatId: string, input: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(chatMessagesUrl(chatId), { input });
  }

  streamMessage(chatId: string, input: string): Observable<string> {
    return new Observable<string>(subscriber => {
      const controller = new AbortController();

      fetch(chatStreamUrl(chatId), {
        method: HttpMethods.post,
        headers: {
          [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
          [CSRF_HEADER]: CSRF_HEADER_VALUE,
        },
        credentials: 'include',
        body: JSON.stringify({ input }),
        signal: controller.signal,
      })
        .then(async response => {
          if (!response.ok) {
            subscriber.error(new Error(`HTTP ${response.status}`));
            return;
          }

          if (response.body === null) {
            subscriber.error(new Error('The response carried no body to stream.'));
            return;
          }

          await pumpStream(response.body, subscriber);
        })
        .catch(err => {
          if ((err as Error).name !== 'AbortError') {
            subscriber.error(err);
          }
        });

      return () => controller.abort();
    });
  }
}
