import { AfterViewInit, Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, Title } from '@angular/platform-browser';
import { PageContainerDirective } from '@crgolden/modules/primitives';
import { NavMenuComponent } from '../nav-menu/nav-menu.component';
import { AuthService } from '../auth/auth.service';
import { SILENT_LOGIN_PROMPT, SILENT_LOGIN_SOURCE } from '../auth/auth-contract';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavMenuComponent, PageContainerDirective],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(window:message)': 'onMessage($event)'
  }
})
export class AppComponent implements AfterViewInit {

  private readonly authService: AuthService = inject(AuthService);
  private readonly titleService: Title = inject(Title);
  private readonly sanitizer: DomSanitizer = inject(DomSanitizer);

  public readonly iframeVisible = signal(false);
  public readonly iframeUrl = signal<SafeResourceUrl | null>(null);

  ngAfterViewInit(): void {
    this.titleService.setTitle('Inventory | Home');

    if (this.authService.isAuthenticated()) {
      return;
    }

    const loginUrl = `${this.authService.loginUrl}?${SILENT_LOGIN_PROMPT}`;
    this.iframeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(loginUrl));
    this.iframeVisible.set(true);
  }

  onMessage(event: MessageEvent): void {
    if (event.origin !== globalThis.location.origin) {
      return;
    }

    const msg = event.data as { source?: string; isLoggedIn?: boolean } | null;
    if (msg?.source !== SILENT_LOGIN_SOURCE) {
      return;
    }

    this.iframeVisible.set(false);
    if (msg.isLoggedIn !== true) {
      return;
    }

    this.authService.refresh();
  }
}
