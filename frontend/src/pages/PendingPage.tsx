import { useState } from 'react'
import { api, ROLE_LABEL, useApi, type PendingRequest } from '../api'
import { useCurrentUser } from '../current-user'
import { daysBetween, formatDate } from '../dates'

export function PendingPage() {
  const { currentUser } = useCurrentUser()
  const { data, error, reload } = useApi<PendingRequest[]>(
    '/deferral-requests/pending',
    currentUser?.id ?? null,
  )
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function decide(request: PendingRequest, action: 'approve' | 'reject') {
    if (!currentUser) return
    setBusyId(request.id)
    setMessage(null)
    try {
      await api(`/deferral-requests/${request.id}/${action}`, currentUser.id, {
        method: 'POST',
        body: {},
      })
      setMessage({
        ok: true,
        text: `${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอ #${request.id} แล้ว`,
      })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusyId(null)
      reload()
    }
  }

  return (
    <section>
      <h1>คำขอที่รออนุมัติ</h1>
      {message && (
        <div className={`notice ${message.ok ? 'success' : 'error'}`}>{message.text}</div>
      )}
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && <p className="muted">ไม่มีคำขอที่รออนุมัติ</p>}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>อุปกรณ์</th>
                <th>ผู้ยื่น</th>
                <th>กำหนดเดิม → วันที่ขอ</th>
                <th>เหตุผล</th>
                <th>ผู้อนุมัติ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    <span className="mono">{r.equipment?.tagNo}</span>
                    <span className={`crit crit-${r.equipment?.criticality}`}>
                      {r.equipment?.criticality}
                    </span>
                    <div className="muted small">{r.equipment?.name}</div>
                  </td>
                  <td>{r.requestedBy?.fullName}</td>
                  <td>
                    {formatDate(r.previousDueDate)} → {formatDate(r.requestedDueDate)}
                    <div className="muted small">
                      +{daysBetween(r.previousDueDate, r.requestedDueDate)} วัน
                      {r.cycleOriginalDueDate !== r.previousDueDate &&
                        ` (รวม +${daysBetween(r.cycleOriginalDueDate, r.requestedDueDate)} วันจาก ${formatDate(r.cycleOriginalDueDate)})`}
                    </div>
                  </td>
                  <td className="reason">{r.reason}</td>
                  <td>
                    <span
                      className={
                        r.requiredApproverRole === 'department_manager'
                          ? 'badge danger'
                          : 'badge'
                      }
                    >
                      {ROLE_LABEL[r.requiredApproverRole]}
                    </span>
                    {r.escalationReason && (
                      <div className="muted small">{r.escalationReason}</div>
                    )}
                  </td>
                  <td className="actions">
                    <button
                      onClick={() => decide(r, 'approve')}
                      disabled={!r.canDecide || busyId !== null}
                      title={r.cannotDecideReason ?? undefined}
                    >
                      อนุมัติ
                    </button>
                    <button
                      className="secondary"
                      onClick={() => decide(r, 'reject')}
                      disabled={!r.canDecide || busyId !== null}
                      title={r.cannotDecideReason ?? undefined}
                    >
                      ปฏิเสธ
                    </button>
                    {r.cannotDecideReason && (
                      <div className="muted small">{r.cannotDecideReason}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
