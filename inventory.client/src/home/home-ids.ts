export const BENEFIT_CARD_ID_PREFIX = 'benefit-card-';

export function benefitCardId(index: number): string {
  return `${BENEFIT_CARD_ID_PREFIX}${index}`;
}
