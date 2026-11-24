const MS_PER_DAY = 24 * 60 * 60 * 1000

function toEpochDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / MS_PER_DAY
}

export function daysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from)
}

export function addDays(date: string, days: number): string {
  return new Date((toEpochDay(date) + days) * MS_PER_DAY).toISOString().slice(0, 10)
}

/** วันนี้ตามเวลาเครื่องผู้ใช้ รูปแบบ YYYY-MM-DD */
export function today(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}
