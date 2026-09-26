import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ButtonPrimaryDirective, ButtonSecondaryDirective, CardDirective, PageContainerDirective } from '@crgolden/modules/primitives';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBook,
  lucideCalendarCheck,
  lucideDollarSign,
  lucideFileText,
  lucideShieldCheck,
  lucideWrench,
} from '@ng-icons/lucide';
import { AuthService } from '../auth/auth.service';
import { benefitCardId } from './home-ids';

type BenefitIcon =
  | 'lucideBook'
  | 'lucideCalendarCheck'
  | 'lucideDollarSign'
  | 'lucideFileText'
  | 'lucideShieldCheck'
  | 'lucideWrench';

interface Benefit {
  icon: BenefitIcon;
  title: string;
  body: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, NgIcon, ButtonPrimaryDirective, ButtonSecondaryDirective, CardDirective, PageContainerDirective],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      lucideBook,
      lucideCalendarCheck,
      lucideDollarSign,
      lucideFileText,
      lucideShieldCheck,
      lucideWrench,
    }),
  ],
})
export class HomeComponent implements OnInit {

  private readonly titleService = inject(Title);
  readonly authService = inject(AuthService);
  protected readonly benefitCardId = benefitCardId;

  readonly benefits: readonly Benefit[] = [
    {
      icon: 'lucideShieldCheck',
      title: 'Insurance Claims',
      body: 'Serial numbers and purchase dates on hand when you need them most — speed up claims and maximize your payouts.'
    },
    {
      icon: 'lucideWrench',
      title: 'Maintenance Scheduling',
      body: 'Track every appliance, vehicle, and device so you never miss a service interval or void a warranty.'
    },
    {
      icon: 'lucideFileText',
      title: 'Estate & Will Preparation',
      body: 'An organized inventory simplifies asset documentation and saves your loved ones hours of guesswork.'
    },
    {
      icon: 'lucideBook',
      title: 'User Manual Access',
      body: 'AI-powered search locates any product manual instantly — no more hunting through boxes or manufacturer sites.'
    },
    {
      icon: 'lucideCalendarCheck',
      title: 'Warranty Tracking',
      body: 'Know exactly what is covered, for how long, and when to act — before coverage lapses.'
    },
    {
      icon: 'lucideDollarSign',
      title: 'Resale Value',
      body: 'Accurate records with serial numbers and service history boost buyer confidence and command higher prices.'
    }
  ];

  ngOnInit(): void {
    this.titleService.setTitle('Inventory | Home');
  }
}
