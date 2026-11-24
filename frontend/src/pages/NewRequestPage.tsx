import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, ROLE_LABEL, useApi, type DeferralRequest, type Equipment } from '../api'
import { useCurrentUser } from '../current-user'
import { DateInput } from '../DateInput'
import { addDays, daysBetween, formatDate, today } from '../dates'

/** ค่าเดียวกับ CRITICALITY_A_MAX_DEFERRAL_DAYS ใน backend/src/deferral/deferral-policy.ts */
const CRITICALITY_A_MAX_DEFERRAL_DAYS = 30

export function NewRequestPage() {
  const { currentUser } = useCurrentUser()
  const [searchParams] = useSearchParams()
  const { data: equipment, reload } = useApi<Equipment[]>(
    '/equipment',
    currentUser?.id ?? null,
  )

  const [equipmentId, setEquipmentId] = useState(searchParams.get('equipmentId') ?? '')
  const [requestedDueDate, setRequestedDueDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<DeferralRequest | null>(null)

  const selected = equipment?.find((e) => String(e.id) === equipmentId)
  // วันที่เลือกได้เร็วสุด: หลังทั้งกำหนดปัจจุบันและวันนี้ (backend ตรวจซ้ำอีกที)
  const minDate = selected
    ? [addDays(selected.nextDueDate, 1), addDays(today(), 1)].sort()[1]
    : undefined
  const cycleOriginal = selected
    ? (selected.cycleOriginalDueDate ?? selected.nextDueDate)
    : null
  // Criticality A เลื่อนรวมเกิน 30 วันจากกำหนดเดิม: ไม่ให้ยื่นจากหน้าจอ (ตัดสินใจฝั่ง UI)
  // หมายเหตุ: backend ยังรับคำขอนี้และส่งต่อให้ผู้จัดการฝ่ายตามนโยบาย 4.2
  const totalDays =
    cycleOriginal && requestedDueDate ? daysBetween(cycleOriginal, requestedDueDate) : 0
  const exceedsLimit =
    selected?.criticality === 'A' && totalDays > CRITICALITY_A_MAX_DEFERRAL_DAYS

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!currentUser) return
    setSubmitting(true)
    setError(null)
    setCreated(null)
    try {
      const result = await api<DeferralRequest>('/deferral-requests', currentUser.id, {
        method: 'POST',
        body: { equipmentId: Number(equipmentId), requestedDueDate, reason },
      })
      setCreated(result)
      setRequestedDueDate('')
      setReason('')
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <h1>ยื่นคำขอเลื่อนกำหนดตรวจสอบ</h1>

      {created && (
        <div className="notice success">
          ยื่นคำขอ #{created.id} แล้ว รอ
          <strong> {ROLE_LABEL[created.requiredApproverRole]} </strong>
          อนุมัติ
          {created.escalationReason && (
            <div className="small">เหตุผลที่ต้องให้ผู้จัดการฝ่ายอนุมัติ: {created.escalationReason}</div>
          )}
          <div className="small">
            <Link to="/requests/pending">ไปที่รายการรออนุมัติ</Link>
          </div>
        </div>
      )}
      {error && <div className="notice error">{error}</div>}

      <form onSubmit={handleSubmit} className="form">
        <label>
          อุปกรณ์
          <select
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
            required
          >
            <option value="">-- เลือกอุปกรณ์ --</option>
            {equipment?.map((e) => (
              <option key={e.id} value={e.id} disabled={e.pendingRequestId !== null}>
                {e.tagNo} · {e.name} (Criticality {e.criticality})
                {e.pendingRequestId !== null ? ' · มีคำขอรออนุมัติ' : ''}
              </option>
            ))}
          </select>
        </label>

        {selected && cycleOriginal && (
          <div className="info small">
            กำหนดตรวจสอบปัจจุบัน <strong>{formatDate(selected.nextDueDate)}</strong>
            {selected.cycleOriginalDueDate && (
              <> (กำหนดเดิมของรอบนี้ {formatDate(selected.cycleOriginalDueDate)})</>
            )}
            {selected.criticality === 'A' && (
              <div>
                Criticality A: เลื่อนรวมได้ไม่เกิน {CRITICALITY_A_MAX_DEFERRAL_DAYS} วันจากกำหนดเดิม
                (ไม่เกิน{' '}
                {formatDate(addDays(cycleOriginal, CRITICALITY_A_MAX_DEFERRAL_DAYS))})
                ถ้าเป็นการเลื่อนครั้งที่ 3 ขึ้นไปในรอบนี้ ต้องให้ผู้จัดการฝ่ายอนุมัติ
              </div>
            )}
          </div>
        )}

        <label>
          วันที่ใหม่
          <DateInput
            value={requestedDueDate}
            min={minDate}
            onChange={setRequestedDueDate}
            required
          />
          {selected && requestedDueDate && (
            <span className="muted small">
              เลื่อนออกไป {daysBetween(selected.nextDueDate, requestedDueDate)} วัน
            </span>
          )}
          {exceedsLimit && (
            <span className="error small">
              เลื่อนรวม {totalDays} วันจากกำหนดเดิม เกิน {CRITICALITY_A_MAX_DEFERRAL_DAYS} วัน
              ยื่นคำขอไม่ได้
            </span>
          )}
        </label>

        <label>
          เหตุผล
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            required
          />
        </label>

        <button type="submit" disabled={submitting || !currentUser || exceedsLimit}>
          {submitting ? 'กำลังส่ง...' : 'ยื่นคำขอ'}
        </button>
      </form>
    </section>
  )
}
