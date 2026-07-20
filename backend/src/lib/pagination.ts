// Shared pagination parsing (tech-spec §8): ?page (int >= 1, default 1), ?limit (1–100, default 20).
export interface Page {
  page: number
  limit: number
}

export function parsePage(pageRaw?: string, limitRaw?: string): Page {
  return {
    page: clampInt(pageRaw, 1, 1, Number.MAX_SAFE_INTEGER),
    limit: clampInt(limitRaw, 20, 1, 100),
  }
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
