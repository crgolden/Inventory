import { HttpClient } from '@angular/common/http';
import { computed, Injectable, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, Observable, of, shareReplay, Subject, switchMap, take } from 'rxjs';
import { Claim } from './claim';
import {
  BFF_LOGIN_URL,
  BFF_SILENT_LOGIN_URL,
  BFF_USER_PATH,
  LOGOUT_URL_CLAIM_TYPE,
  NAME_CLAIM_TYPE,
} from './auth-contract';

export type { Claim } from './claim';
export type Session = Claim[];

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly http = inject(HttpClient);
  private readonly _refresh$ = new Subject<void>();

  private readonly _fetchResult$ = this._refresh$.pipe(
    switchMap(() =>
      this.http.get<Claim[]>(BFF_USER_PATH).pipe(
        catchError(() => of(null))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly _fetchResult = toSignal(this._fetchResult$, {
    initialValue: null as Claim[] | null
  });

  public readonly isAuthenticated: Signal<boolean> = computed(() => this._fetchResult() !== null);
  public readonly isAnonymous: Signal<boolean> = computed(() => this._fetchResult() === null);
  public readonly session: Signal<Session> = computed(() => this._fetchResult() ?? []);
  public readonly username: Signal<string | null> = computed(
    () => this._fetchResult()?.find(x => x.type === NAME_CLAIM_TYPE)?.value ?? null
  );
  public readonly logoutUrl: Signal<string | null> = computed(() => {
    const s = this._fetchResult();
    if (!s) return null;
    return s.find(x => x.type === LOGOUT_URL_CLAIM_TYPE)?.value ?? null;
  });

  public readonly silentLoginUrl: string = BFF_SILENT_LOGIN_URL;
  public readonly loginUrl: string = BFF_LOGIN_URL;

  public initialize(): Observable<Session> {
    this._refresh$.next();
    return this._fetchResult$.pipe(
      map(s => s ?? []),
      take(1)
    );
  }

  public refresh(): void {
    this._refresh$.next();
  }
}
