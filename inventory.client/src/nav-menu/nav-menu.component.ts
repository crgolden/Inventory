import { Component, inject, signal, ChangeDetectionStrategy, WritableSignal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PageContainerDirective } from '@crgolden/modules/primitives';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMenu } from '@ng-icons/lucide';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-nav-menu',
  imports: [RouterLink, RouterLinkActive, NgIcon, PageContainerDirective],
  templateUrl: './nav-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideMenu })]
})
export class NavMenuComponent {

  private readonly authService: AuthService = inject(AuthService);

  public readonly isAuthenticated = this.authService.isAuthenticated;
  public readonly isAnonymous = this.authService.isAnonymous;
  public readonly logoutUrl = this.authService.logoutUrl;
  public readonly isExpanded: WritableSignal<boolean> = signal(false);

  collapse() {
    this.isExpanded.set(false);
  }

  toggle() {
    this.isExpanded.update(expanded => !expanded);
  }
}
