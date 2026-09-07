function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

export function utcInstantToDateTimeLocalInput(iso: string | null): string | null {
  if (iso === null) {
    return null;
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const date = `${pad(parsed.getFullYear(), 4)}-${pad(parsed.getMonth() + 1, 2)}-${pad(parsed.getDate(), 2)}`;
  const time = `${pad(parsed.getHours(), 2)}:${pad(parsed.getMinutes(), 2)}`;
  return `${date}T${time}`;
}

export function dateTimeLocalInputToUtcInstant(value: string | null): string | null {
  if (value === null || value.length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}
