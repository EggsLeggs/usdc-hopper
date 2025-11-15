export function formatAmount(
  value: string | number,
  options: Intl.NumberFormatOptions = {},
) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
    ...options,
  }).format(numeric || 0);
}

export function formatUsd(value: string | number) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(numeric || 0);
}

export function formatDuration(seconds?: number) {
  if (!seconds || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  return `${mins} min${mins === 1 ? "" : "s"}`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

