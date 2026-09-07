const DATETIME_LOCAL_LENGTH = 'YYYY-MM-DDTHH:mm'.length;

export function utcInstantToDateTimeLocalInput(iso: string | null): string | null {
  if (iso === null) {
    return null;
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, DATETIME_LOCAL_LENGTH);
}

export function dateTimeLocalInputToUtcInstant(value: string | null): string | null {
  if (value === null || value.length === 0) {
    return null;
  }

  const parsed = new Date(`${value}Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}
