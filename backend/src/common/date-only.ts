/**
 * วันที่ทั้งระบบใช้เป็น string รูปแบบ YYYY-MM-DD (ไม่มีเวลา ไม่มี timezone)
 * เพื่อเลี่ยงบั๊กวันเลื่อนจากการแปลง timezone ของ JS Date
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toEpochDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** จำนวนวันจาก `from` ถึง `to` (ติดลบได้ถ้า `to` มาก่อน) */
export function daysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function addDays(date: string, days: number): string {
  return new Date((toEpochDay(date) + days) * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** วันที่ปัจจุบันตาม timezone ที่ระบุ ในรูปแบบ YYYY-MM-DD */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // locale en-CA ให้รูปแบบ YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
