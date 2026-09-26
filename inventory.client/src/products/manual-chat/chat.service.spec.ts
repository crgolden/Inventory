import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { newCount, newCountCeiling, newDisplayName, newId, newText } from '@crgolden/modules/testing';
import { ChatService } from './chat.service';
import {
  CHATS_URL,
  chatMessagesUrl,
  chatStreamUrl,
  chatUrl,
  frameNotJsonMessage,
  frameWithoutDeltaMessage,
  MERGE_PATCH_CONTENT_TYPE,
  SseFraming,
} from './chat-api';
import { CONTENT_TYPE_HEADER, HttpMethods } from '../../app/http-headers';
import { ChatRoles } from './chat.model';
import { firstValueFrom } from 'rxjs';

function sseFrame(data: string): string {
  return `${SseFraming.dataPrefix}${data}\n\n`;
}

function deltaFrame(content: unknown): string {
  return sseFrame(JSON.stringify({ delta: { content } }));
}

function streamOf(...frames: string[]): string {
  return [...frames, sseFrame(SseFraming.done)].join('');
}

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getChat GETs the correct URL and returns a chat', async () => {
    const chatId = newId();
    const title = newDisplayName();
    const promise = firstValueFrom(service.getChat(chatId));
    const req = httpMock.expectOne(chatUrl(chatId));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush({ chatId, title, createdAt: newCountCeiling() });
    const result = await promise;
    expect(result.chatId).toBe(chatId);
    expect(result.title).toBe(title);
  });

  it('createChat POSTs to the chats collection and returns the created chat', async () => {
    const chatId = newId();
    const promise = firstValueFrom(service.createChat());
    const req = httpMock.expectOne(CHATS_URL);
    expect(req.request.method).toBe(HttpMethods.post);
    req.flush({ chatId, title: null, createdAt: newCountCeiling() });
    const result = await promise;
    expect(result.chatId).toBe(chatId);
    expect(result.title).toBeNull();
  });

  it('updateChatTitle PATCHes the correct URL with merge-patch content type', async () => {
    const chatId = newId();
    const title = newDisplayName();
    const promise = firstValueFrom(service.updateChatTitle(chatId, title));
    const req = httpMock.expectOne(chatUrl(chatId));
    expect(req.request.method).toBe(HttpMethods.patch);
    expect(req.request.headers.get(CONTENT_TYPE_HEADER)).toBe(MERGE_PATCH_CONTENT_TYPE);
    expect(req.request.body).toEqual({ title });
    req.flush(null, { status: HttpStatusCode.NoContent, statusText: newText() });
    await promise;
  });

  it('deleteChat DELETEs the correct URL', async () => {
    const chatId = newId();
    const promise = firstValueFrom(service.deleteChat(chatId));
    const req = httpMock.expectOne(chatUrl(chatId));
    expect(req.request.method).toBe(HttpMethods.delete);
    req.flush(null, { status: HttpStatusCode.NoContent, statusText: newText() });
    await promise;
  });

  it('getChatMessages GETs the correct URL and returns messages', async () => {
    const chatId = newId();
    const history = [
      { role: ChatRoles.user, text: newText() },
      { role: ChatRoles.assistant, text: newText() },
    ];
    const promise = firstValueFrom(service.getChatMessages(chatId));
    const req = httpMock.expectOne(chatMessagesUrl(chatId));
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush(history);
    expect(await promise).toEqual(history);
  });

  it('sendMessage POSTs to the correct URL with input body', async () => {
    const chatId = newId();
    const input = newText();
    const output = newText();
    const promise = firstValueFrom(service.sendMessage(chatId, input));
    const req = httpMock.expectOne(chatMessagesUrl(chatId));
    expect(req.request.method).toBe(HttpMethods.post);
    expect(req.request.body).toEqual({ input });
    req.flush({ output, chatId });
    const response = await promise;
    expect(response.output).toBe(output);
    expect(response.chatId).toBe(chatId);
  });

  it('streamMessage parses SSE deltas and completes on [DONE]', async () => {
    const chatId = newId();
    const contents = [newText(), ` ${newText()}`];
    const encoded = new TextEncoder().encode(streamOf(...contents.map(deltaFrame)));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoded);
            controller.close();
          },
        }),
        { status: HttpStatusCode.Ok },
      ),
    );

    const deltas: string[] = [];
    await new Promise<void>((resolve, reject) => {
      service.streamMessage(chatId, newText()).subscribe({
        next: (d) => deltas.push(d),
        complete: resolve,
        error: reject,
      });
    });

    expect(deltas).toEqual(contents);
    expect(fetchSpy).toHaveBeenCalledWith(
      chatStreamUrl(chatId),
      expect.objectContaining({ method: HttpMethods.post }),
    );
    fetchSpy.mockRestore();
  });

  async function collectStream(sseChunk: string): Promise<{ deltas: string[]; error: unknown }> {
    const encoded = new TextEncoder().encode(sseChunk);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoded);
            controller.close();
          },
        }),
        { status: HttpStatusCode.Ok },
      ),
    );

    const deltas: string[] = [];
    const result = await new Promise<{ deltas: string[]; error: unknown }>((resolve) => {
      service.streamMessage(newId(), newText()).subscribe({
        next: (d) => deltas.push(d),
        complete: () => resolve({ deltas, error: null }),
        error: (err: unknown) => resolve({ deltas, error: err }),
      });
    });

    fetchSpy.mockRestore();
    return result;
  }

  it('streamMessage surfaces a frame that is not JSON instead of skipping it', async () => {
    const firstContent = newText();
    const badFrame = `{${newText()}`;
    const { deltas, error } = await collectStream(streamOf(deltaFrame(firstContent), sseFrame(badFrame)));

    expect(deltas).toEqual([firstContent]);
    expect((error as Error).message).toBe(frameNotJsonMessage(badFrame));
  });

  it('streamMessage surfaces a well-formed frame that carries no delta.content', async () => {
    const wrongShape = JSON.stringify({ [newText()]: [{ [newText()]: newText() }] });
    const { deltas, error } = await collectStream(streamOf(sseFrame(wrongShape)));

    expect(deltas).toEqual([]);
    expect((error as Error).message).toBe(frameWithoutDeltaMessage(wrongShape));
  });

  it('streamMessage rejects a delta whose content is not a string', async () => {
    const numericContent = JSON.stringify({ delta: { content: newCount() } });
    const { error } = await collectStream(streamOf(sseFrame(numericContent)));

    expect((error as Error).message).toBe(frameWithoutDeltaMessage(numericContent));
  });
});
