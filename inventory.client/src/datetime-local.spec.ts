import { dateTimeLocalInputToUtcInstant, utcInstantToDateTimeLocalInput } from './datetime-local';

const MS_PER_MINUTE = 60_000;

describe('utcInstantToDateTimeLocalInput', () => {
  it('renders the instant as the wall clock the viewer would read on their own machine', () => {
    const wallClock = '2024-01-15T09:00';
    const instant = new Date(wallClock).toISOString();

    expect(utcInstantToDateTimeLocalInput(instant)).toBe(wallClock);
  });

  it('shifts by the local offset rather than printing the UTC components', () => {
    const instant = '2024-06-15T12:00:00Z';
    const offsetMinutes = -new Date(instant).getTimezoneOffset();
    const rendered = utcInstantToDateTimeLocalInput(instant);
    if (rendered === null) {
      throw new Error('The conversion returned null, so there is no rendered value to compare.');
    }

    const shiftMinutes = (new Date(`${rendered}Z`).getTime() - new Date(instant).getTime()) / MS_PER_MINUTE;
    expect(shiftMinutes).toBe(offsetMinutes);
  });

  it('pads every component to the width datetime-local requires', () => {
    const rendered = utcInstantToDateTimeLocalInput(new Date('2024-03-04T05:06').toISOString());

    expect(rendered).toBe('2024-03-04T05:06');
  });

  it('returns null for a null instant', () => {
    expect(utcInstantToDateTimeLocalInput(null)).toBeNull();
  });

  it('returns null rather than "Invalid Date" for an unparseable instant', () => {
    expect(utcInstantToDateTimeLocalInput('not-a-date')).toBeNull();
  });
});

describe('dateTimeLocalInputToUtcInstant', () => {
  it('reads the control value as local time, not as UTC', () => {
    const wallClock = '2024-06-15T14:30';

    expect(dateTimeLocalInputToUtcInstant(wallClock)).toBe(new Date(wallClock).toISOString());
  });

  it('returns null for null and for the empty value an untouched control holds', () => {
    expect(dateTimeLocalInputToUtcInstant(null)).toBeNull();
    expect(dateTimeLocalInputToUtcInstant('')).toBeNull();
  });

  it('returns null rather than "Invalid Date" for an unparseable value', () => {
    expect(dateTimeLocalInputToUtcInstant('not-a-date')).toBeNull();
  });
});

describe('the datetime-local round trip', () => {
  it('returns the original instant, so an untouched date cannot drift on save', () => {
    const instant = new Date('2024-11-02T23:45').toISOString();

    const rendered = utcInstantToDateTimeLocalInput(instant);
    expect(dateTimeLocalInputToUtcInstant(rendered)).toBe(instant);
  });

  it('holds for an instant on the other side of the year, so it is not a DST accident', () => {
    const instant = new Date('2024-05-02T23:45').toISOString();

    const rendered = utcInstantToDateTimeLocalInput(instant);
    expect(dateTimeLocalInputToUtcInstant(rendered)).toBe(instant);
  });
});
