import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { ManualChatComponent } from './manual-chat.component';
import { ProductContext } from './chat.model';

@Component({
  selector: 'app-manual-chat-panel',
  imports: [ManualChatComponent, NgIcon],
  templateUrl: './manual-chat-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideSearch, lucideX })],
})
export class ManualChatPanelComponent {

  readonly productContext = input<ProductContext | null>(null);
  readonly manualUrlSelected = output<string>();

  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  onUrlSelected(url: string): void {
    this.manualUrlSelected.emit(url);
  }
}
