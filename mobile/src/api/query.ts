export function queryString<T extends object>(values: T): string {
  const parts = (
    Object.entries(values) as [string, string | number | boolean | undefined][]
  )
    .filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}
