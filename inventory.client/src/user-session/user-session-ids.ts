export const USER_SESSION_ROW_ID_PREFIX = 'user-session-row-';

export const USER_SESSION_CLAIM_TYPE_ID_PREFIX = 'user-session-claim-type-';

export const USER_SESSION_CLAIM_VALUE_ID_PREFIX = 'user-session-claim-value-';

export function userSessionRowId(index: number): string {
  return `${USER_SESSION_ROW_ID_PREFIX}${index}`;
}

export function userSessionClaimTypeId(index: number): string {
  return `${USER_SESSION_CLAIM_TYPE_ID_PREFIX}${index}`;
}

export function userSessionClaimValueId(index: number): string {
  return `${USER_SESSION_CLAIM_VALUE_ID_PREFIX}${index}`;
}
