import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import {
  CHAT_START_FAILED_MESSAGE,
  ManualChatComponent,
  STREAM_FAILED_MESSAGE,
} from './manual-chat.component';
import { ChatService } from './chat.service';
import { CHATS_URL } from './chat-api';
import { ChatRoles } from './chat.model';
import { of, Subject, throwError } from 'rxjs';
import { newCount, newHttpsAddress, newId, newText } from '@crgolden/modules/testing';
import { HttpMethods } from '../../app/http-headers';

describe('ManualChatComponent', () => {
  let fixture: ComponentFixture<ManualChatComponent>;
  let component: ManualChatComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManualChatComponent],
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ManualChatComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('renders the empty-state prompt when there are no messages', () => {
    expect(fixture.debugElement.query(By.css('#manual-chat-empty'))).toBeTruthy();
  });

  it('send button is disabled when input is empty', () => {
    const btn = fixture.debugElement.query(By.css('#manual-chat-send'));
    expect(btn.nativeElement.disabled).toBe(true);
  });

  it('urlsFor extracts unique http(s) URLs from assistant content', () => {
    const first = newHttpsAddress();
    const second = newHttpsAddress();
    const urls = component.urlsFor(`${newText()} ${first} ${newText()} ${second} ${newText()} ${first}`);
    expect(urls).toEqual([first, second]);
  });

  it('urlsFor strips trailing markdown/paren punctuation', () => {
    const manual = newHttpsAddress();
    const urls = component.urlsFor(`${newText()} [${newText()}](${manual}).`);
    expect(urls).toEqual([manual]);
  });

  it('selectUrl emits manualUrlSelected', () => {
    const emitted: string[] = [];
    component.manualUrlSelected.subscribe((v) => emitted.push(v));
    const picked = newHttpsAddress();
    component.selectUrl(picked);
    expect(emitted).toEqual([picked]);
  });

  it('first send() creates a chat then streams to the new chatId', () => {
    const chatService = TestBed.inject(ChatService);
    const streamSpy = vi.spyOn(chatService, 'streamMessage').mockReturnValue(of());

    const question = newText();
    const chatId = newId();
    component.input.set(question);
    component.send();

    const createReq = httpMock.expectOne(CHATS_URL);
    expect(createReq.request.method).toBe(HttpMethods.post);
    createReq.flush({ chatId, title: null, createdAt: newCount() });

    expect(streamSpy).toHaveBeenCalledWith(chatId, question);
    expect(component.chatId()).toBe(chatId);
  });

  it('subsequent send() reuses the existing chat id', () => {
    const chatService = TestBed.inject(ChatService);
    const createSpy = vi.spyOn(chatService, 'createChat');
    const streamSpy = vi.spyOn(chatService, 'streamMessage').mockReturnValue(of());

    const existingChatId = newId();
    const question = newText();
    component.chatId.set(existingChatId);
    component.input.set(question);
    component.send();

    expect(createSpy).not.toHaveBeenCalled();
    expect(streamSpy).toHaveBeenCalledWith(existingChatId, question);
  });

  it('streamed deltas append to the last assistant message', () => {
    const chatService = TestBed.inject(ChatService);
    const deltas = [newText(), ` ${newText()}`];
    vi.spyOn(chatService, 'streamMessage').mockReturnValue(of(...deltas));

    component.chatId.set(newId());
    component.input.set(newText());
    component.send();

    const last = component.messages().at(-1);
    if (last === undefined) {
      throw new Error('send() left the message list empty, so there is no assistant reply to assert on.');
    }

    expect(last.role).toBe(ChatRoles.assistant);
    expect(last.content).toBe(deltas.join(''));
  });

  it('a failed stream stops the spinner and tells the user, rather than going quiet', () => {
    const chatService = TestBed.inject(ChatService);
    vi.spyOn(chatService, 'streamMessage').mockReturnValue(
      throwError(() => new Error(crypto.randomUUID())),
    );

    component.chatId.set(newId());
    component.input.set(newText());
    component.send();
    fixture.detectChanges();

    expect(component.streaming()).toBe(false);
    const alert = fixture.debugElement.query(By.css('#manual-chat-error'));
    expect(alert.nativeElement.textContent).toContain(STREAM_FAILED_MESSAGE);
  });

  it('a failed chat creation tells the user instead of leaving the send button disabled forever', () => {
    component.input.set(newText());
    component.send();

    httpMock
      .expectOne(CHATS_URL)
      .flush(null, { status: HttpStatusCode.ServiceUnavailable, statusText: newText() });
    fixture.detectChanges();

    expect(component.streaming()).toBe(false);
    const alert = fixture.debugElement.query(By.css('#manual-chat-error'));
    expect(alert.nativeElement.textContent).toContain(CHAT_START_FAILED_MESSAGE);
  });

  it('destroying the component tears the stream down instead of writing to a dead view', () => {
    const chatService = TestBed.inject(ChatService);
    const stream$ = new Subject<string>();
    vi.spyOn(chatService, 'streamMessage').mockReturnValue(stream$.asObservable());

    const firstDelta = newText();
    component.chatId.set(newId());
    component.input.set(newText());
    component.send();
    stream$.next(firstDelta);

    const before = component.messages().at(-1)?.content;
    fixture.destroy();
    stream$.next(` ${newText()}`);

    expect(before).toBe(firstDelta);
    expect(component.messages().at(-1)?.content).toBe(firstDelta);
  });
});
