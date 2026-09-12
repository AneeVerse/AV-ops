export async function salesFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/sales-api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function titleize(value = "") {
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
