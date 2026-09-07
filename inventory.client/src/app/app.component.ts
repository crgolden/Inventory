import { AfterViewInit, Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, Title } from '@angular/platform-browser';
import { NavMenuComponent } from '../nav-menu/nav-menu.component';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavMenuComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
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

    const loginUrl = `${this.authService.loginUrl}?prompt=none`;
    this.iframeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(loginUrl));
    this.iframeVisible.set(true);
  }

  onMessage(event: MessageEvent): void {
    // The iframe is same-origin (it loads the BFF's own /bff/login), so anything claiming to be the
    // silent-login result from another origin is not it. Without this check any frame able to
    // postMessage to this page could spoof { source: 'bff-silent-login', isLoggedIn: true } and drive
    // an unsolicited token refresh.
    if (event.origin !== globalThis.location.origin) {
      return;
    }

    const msg = event.data as { source?: string; isLoggedIn?: boolean } | null;
    if (msg?.source !== 'bff-silent-login') {
      return;
    }

    this.iframeVisible.set(false);
    if (msg.isLoggedIn !== true) {
      return;
    }

    this.authService.refresh();
  }
}
