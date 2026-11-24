import { useCallback, useEffect, useState } from 'react'

export type UserRole = 'requester' | 'supervisor' | 'department_manager'
export type ApproverRole = 'supervisor' | 'department_manager'

export interface User {
  id: number
  username: string
  fullName: string
  role: UserRole
}

export interface Equipment {
  id: number
  tagNo: string
  name: string
  location: string
  criticality: 'A' | 'B' | 'C'
  nextDueDate: string
  cycleOriginalDueDate: string | null
  pendingRequestId: number | null
  /** จำนวนวันจากวันนี้ (ตามเวลา backend) ถึงกำหนดตรวจสอบ ติดลบ = เลยกำหนด */
  daysUntilDue: number
}

export interface DeferralRequest {
  id: number
  equipmentId: number
  equipment?: Equipment
  requestedById: number
  requestedBy?: User
  previousDueDate: string
  cycleOriginalDueDate: string
  requestedDueDate: string
  reason: string
  requiredApproverRole: ApproverRole
  escalationReason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
}

export interface PendingRequest extends DeferralRequest {
  canDecide: boolean
  cannotDecideReason: string | null
}

export const ROLE_LABEL: Record<UserRole, string> = {
  requester: 'ผู้ยื่นคำขอ',
  supervisor: 'หัวหน้างาน',
  department_manager: 'ผู้จัดการฝ่าย',
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * เรียก backend ผ่าน /api (Vite proxy ส่งต่อไปที่ localhost:3000)
 * ส่ง X-User-Id แทนการ login ตามที่โจทย์กำหนด
 */
export async function api<T>(
  path: string,
  userId: number | null,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (userId !== null) headers['X-User-Id'] = String(userId)

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const data: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const message = (data as { message?: string | string[] } | null)?.message
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(', ') : (message ?? `HTTP ${res.status}`),
    )
  }
  return data as T
}

/** โหลดข้อมูลตอนเปิดหน้า และโหลดใหม่เมื่อ path หรือ user เปลี่ยน */
export function useApi<T>(path: string, userId: number | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (userId === null) return
    let cancelled = false
    api<T>(path, userId)
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [path, userId, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])
  return { data, error, reload }
}
