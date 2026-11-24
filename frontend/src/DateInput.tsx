import { useRef, useState } from 'react'
import { formatDate } from './dates'

/** แปลง "วว/ดด/ปปปป" เป็น "YYYY-MM-DD" คืน '' ถ้ารูปแบบผิดหรือไม่มีวันนั้นจริง */
function parseThaiDate(text: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  if (!match) return ''
  const [, d, m, y] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  // กันวันที่ที่ไม่มีจริง เช่น 30/02 ที่ Date จะเลื่อนไปเป็น 02/03 เอง
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return ''
  }
  return date.toISOString().slice(0, 10)
}

interface DateInputProps {
  /** "YYYY-MM-DD" หรือ '' (ค่าเดียวกับที่ส่งให้ API) */
  value: string
  onChange: (value: string) => void
  min?: string
  required?: boolean
}

/**
 * ช่องวันที่แสดงเป็น วัน/เดือน/ปี เสมอ
 * input type="date" ของเบราว์เซอร์แสดงรูปแบบตามภาษาของเบราว์เซอร์ (เช่น เดือน/วัน/ปี)
 * และกำหนดเองไม่ได้ จึงใช้ช่องข้อความ แล้วเปิดปฏิทินของเบราว์เซอร์ผ่าน showPicker()
 * เมื่อกดในช่องหรือที่ไอคอน (พิมพ์วันที่เองก็ได้)
 */
export function DateInput({ value, onChange, min, required }: DateInputProps) {
  const [text, setText] = useState(value ? formatDate(value) : '')
  const [prevValue, setPrevValue] = useState(value)
  const pickerRef = useRef<HTMLInputElement>(null)

  // ค่าเปลี่ยนจากข้างนอก (เช่น ล้างฟอร์มหลังยื่นสำเร็จ) ให้ช่องข้อความตามไปด้วย
  // ปรับ state ระหว่าง render ตามแนวทางของ React แทนการใช้ useEffect
  if (value !== prevValue) {
    setPrevValue(value)
    if (value !== parseThaiDate(text)) {
      setText(value ? formatDate(value) : '')
    }
  }

  function handleTextChange(next: string) {
    setText(next)
    onChange(parseThaiDate(next))
  }

  function openPicker() {
    try {
      pickerRef.current?.showPicker()
    } catch {
      // เบราว์เซอร์ที่ไม่รองรับ showPicker หรือปฏิทินเปิดอยู่แล้ว: ยังพิมพ์วันที่เองได้
    }
  }

  return (
    <div className="date-input">
      <input
        type="text"
        inputMode="numeric"
        placeholder="วว/ดด/ปปปป"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        onClick={openPicker}
        pattern="\d{1,2}/\d{1,2}/\d{4}"
        title="วัน/เดือน/ปี เช่น 31/12/2026"
        required={required}
      />
      <button
        type="button"
        className="date-input-button"
        aria-label="เลือกจากปฏิทิน"
        onClick={openPicker}
      >
        <CalendarIcon />
      </button>
      {/* ปฏิทินของเบราว์เซอร์ ซ่อนไว้ ใช้แค่ตอนกดปุ่ม */}
      <input
        ref={pickerRef}
        type="date"
        className="date-input-picker"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        onChange={(e) => {
          setText(e.target.value ? formatDate(e.target.value) : '')
          onChange(e.target.value)
        }}
      />
    </div>
  )
}

/** ไอคอนปฏิทินแบบเส้น ใช้สีตามตัวอักษร (currentColor) */
function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
