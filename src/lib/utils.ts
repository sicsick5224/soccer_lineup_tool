export function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'ko');
}
