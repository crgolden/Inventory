import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from './chat.service';
import { ChatMessage, ProductContext } from './chat.model';
import { MarkdownPipe } from './markdown.pipe';

const URL_REGEX = /\bhttps?:\/\/[^\s)>\]"']+/g;

@Component({
  selector: 'app-manual-chat',
  imports: [FormsModule, MarkdownPipe],
  templateUrl: './manual-chat.component.html',
  styleUrl: './manual-chat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualChatComponent {

  private readonly chatService = inject(ChatService);

  readonly productContext = input<ProductContext | null>(null);
  readonly manualUrlSelected = output<string>();

  readonly messages = signal<ChatMessage[]>([]);
  readonly input = signal('');
  readonly streaming = signal(false);
  readonly chatId = signal<string | null>(null);

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
    this.chatService.createChat().subscribe({
      next: chat => {
        this.chatId.set(chat.chatId);
        const title = this.buildInitialTitle();
        if (title) {
          this.chatService.updateChatTitle(chat.chatId, title).subscribe({
            error: () => undefined,
          });
        }

        this.streaming.set(false);
        this.dispatch(chat.chatId, text);
      },
      error: () => this.streaming.set(false),
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
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]);
    this.input.set('');
    this.streaming.set(true);

    this.chatService.streamMessage(chatId, text).subscribe({
      next: delta => {
        this.messages.update(msgs => {
          const updated = [...msgs];
          const last = updated.at(-1)!;
          updated[updated.length - 1] = { ...last, content: last.content + delta };
          return updated;
        });
      },
      complete: () => this.streaming.set(false),
      error: () => this.streaming.set(false),
    });
  }

  private buildInitialTitle(): string {
    const ctx = this.productContext();
    const parts = ['Manual:', ctx?.name, ctx?.brand, ctx?.modelNumber].filter(Boolean) as string[];
    if (parts.length <= 1) {
      return '';
    }

    const title = parts.join(' ');
    return title.length > 60 ? `${title.slice(0, 60)}…` : title;
  }
}
