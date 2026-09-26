import { newText, randomIntBetween } from '@crgolden/modules/testing';
import { dateTimeLocalInputToUtcInstant, utcInstantToDateTimeLocalInput } from './datetime-local';
import { DateMonthIndexes } from './testing/ecmascript-date-constants';

const MS_PER_MINUTE = new Date(0).setUTCMinutes(1);

function newTwoDigitWallClock(): string {
  const year = randomIntBetween(2000, 2100);
  const month = randomIntBetween(10, 13);
  const day = randomIntBetween(10, 29);
  const hour = randomIntBetween(10, 24);
  const minute = randomIntBetween(10, 60);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function newSingleDigitWallClock(): string {
  const year = randomIntBetween(2000, 2100);
  const month = randomIntBetween(1, 10);
  const day = randomIntBetween(1, 10);
  const hour = randomIntBetween(1, 10);
  const minute = randomIntBetween(1, 10);
  return `${year}-0${month}-0${day}T0${hour}:0${minute}`;
}

function newMinuteAlignedInstant(firstMonth: number, lastMonthExclusive: number): string {
  return new Date(
    randomIntBetween(2000, 2100),
    randomIntBetween(firstMonth, lastMonthExclusive),
    randomIntBetween(1, 29),
    randomIntBetween(0, 24),
    randomIntBetween(0, 60),
  ).toISOString();
}

describe('utcInstantToDateTimeLocalInput', () => {
  it('renders the instant as the wall clock the viewer would read on their own machine', () => {
    const wallClock = newTwoDigitWallClock();
    const instant = new Date(wallClock).toISOString();

    expect(utcInstantToDateTimeLocalInput(instant)).toBe(wallClock);
  });

  it('displaces the wall clock from the instant by exactly the zone offset', () => {
    const instant = newMinuteAlignedInstant(DateMonthIndexes.january, DateMonthIndexes.pastDecember);
    const rendered = utcInstantToDateTimeLocalInput(instant);
    if (rendered === null) {
      throw new Error('The conversion returned null, so there is no rendered value to compare.');
    }

    const shiftMinutes = (new Date(`${rendered}Z`).getTime() - new Date(instant).getTime()) / MS_PER_MINUTE;
    const zoneOffsetMinutes = new Date(instant).getTimezoneOffset();

    expect(shiftMinutes + zoneOffsetMinutes).toBe(0);
  });

  it('pads every component to the width datetime-local requires', () => {
    const wallClock = newSingleDigitWallClock();

    const rendered = utcInstantToDateTimeLocalInput(new Date(wallClock).toISOString());

    expect(rendered).toBe(wallClock);
  });

  it('returns null for a null instant', () => {
    expect(utcInstantToDateTimeLocalInput(null)).toBeNull();
  });

  it('returns null rather than "Invalid Date" for an unparseable instant', () => {
    expect(utcInstantToDateTimeLocalInput(newText())).toBeNull();
  });
});

describe('dateTimeLocalInputToUtcInstant', () => {
  it('reads the control value as local time, not as UTC', () => {
    const wallClock = newTwoDigitWallClock();

    expect(dateTimeLocalInputToUtcInstant(wallClock)).toBe(new Date(wallClock).toISOString());
  });

  it('returns null for null and for the empty value an untouched control holds', () => {
    expect(dateTimeLocalInputToUtcInstant(null)).toBeNull();
    expect(dateTimeLocalInputToUtcInstant('')).toBeNull();
  });

  it('returns null rather than "Invalid Date" for an unparseable value', () => {
    expect(dateTimeLocalInputToUtcInstant(newText())).toBeNull();
  });
});

describe('the datetime-local round trip', () => {
  it('returns the original instant, so an untouched date cannot drift on save', () => {
    const instant = newMinuteAlignedInstant(DateMonthIndexes.july, DateMonthIndexes.pastDecember);

    const rendered = utcInstantToDateTimeLocalInput(instant);
    expect(dateTimeLocalInputToUtcInstant(rendered)).toBe(instant);
  });

  it('holds for an instant on the other side of the year, so it is not a DST accident', () => {
    const instant = newMinuteAlignedInstant(DateMonthIndexes.january, DateMonthIndexes.july);

    const rendered = utcInstantToDateTimeLocalInput(instant);
    expect(dateTimeLocalInputToUtcInstant(rendered)).toBe(instant);
  });
});
