import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonPrimaryDirective, ButtonSecondaryDirective } from '@crgolden/modules/primitives';
import { ChatService } from './chat.service';
import { ChatMessage, ChatRoles, ProductContext } from './chat.model';
import { MarkdownPipe } from './markdown.pipe';
import { MarkdownProseDirective } from './markdown-prose.directive';

const URL_REGEX = /\bhttps?:\/\/[^\s)>\]"']+/g;

export const CHAT_START_FAILED_MESSAGE = 'Could not start a chat. Please try again.';

export const STREAM_FAILED_MESSAGE = 'The reply stopped unexpectedly. Please send your message again.';

@Component({
  selector: 'app-manual-chat',
  imports: [FormsModule, MarkdownPipe, MarkdownProseDirective, ButtonPrimaryDirective, ButtonSecondaryDirective],
  templateUrl: './manual-chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-auto flex-col' },
})
export class ManualChatComponent {

  private readonly chatService = inject(ChatService);
  private readonly destroyRef = inject(DestroyRef);

  readonly productContext = input<ProductContext | null>(null);
  readonly manualUrlSelected = output<string>();

  readonly messages = signal<ChatMessage[]>([]);
  readonly input = signal('');
  readonly streaming = signal(false);
  readonly chatId = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly hasMessages = computed(() => this.messages().length > 0);

  urlsFor(content: string): string[] {
    const matches = content.match(URL_REGEX) ?? [];
    const cleaned = matches.map(u => u.replace(/[.,;:!?)>\]"']+$/, ''));
    return Array.from(new Set(cleaned));
  }

  selectUrl(url: string): void {
    this.manualUrlSelected.emit(url);
  }

  send(): void {
    const text = this.input().trim();
    if (!text || this.streaming()) return;

    const existingId = this.chatId();
    if (existingId) {
      this.dispatch(existingId, text);
      return;
    }

    this.streaming.set(true);
    this.error.set(null);
    this.chatService.createChat().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: chat => {
        this.chatId.set(chat.chatId);
        this.setInitialTitle(chat.chatId);
        this.streaming.set(false);
        this.dispatch(chat.chatId, text);
      },
      error: () => {
        this.streaming.set(false);
        this.error.set(CHAT_START_FAILED_MESSAGE);
      },
    });
  }

  private setInitialTitle(chatId: string): void {
    const title = this.buildInitialTitle();
    if (title === null) {
      return;
    }

    this.chatService.updateChatTitle(chatId, title).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      error: () => undefined,
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private dispatch(chatId: string, text: string): void {
    this.messages.update(msgs => [
      ...msgs,
      { role: ChatRoles.user, content: text },
      { role: ChatRoles.assistant, content: '' },
    ]);
    this.input.set('');
    this.streaming.set(true);
    this.error.set(null);

    this.chatService.streamMessage(chatId, text).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: delta => {
        this.messages.update(msgs => {
          const last = msgs.at(-1);
          if (last === undefined) {
            return msgs;
          }

          const updated = [...msgs];
          updated[updated.length - 1] = { ...last, content: last.content + delta };
          return updated;
        });
      },
      complete: () => this.streaming.set(false),
      error: () => {
        this.streaming.set(false);
        this.error.set(STREAM_FAILED_MESSAGE);
      },
    });
  }

  private buildInitialTitle(): string | null {
    const ctx = this.productContext();
    const parts = ['Manual:', ctx?.name, ctx?.brand, ctx?.modelNumber].filter(Boolean) as string[];
    if (parts.length <= 1) {
      return null;
    }

    const title = parts.join(' ');
    return title.length > 60 ? `${title.slice(0, 60)}…` : title;
  }
}
