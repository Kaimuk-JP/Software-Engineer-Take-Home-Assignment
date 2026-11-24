import { Link } from 'react-router'
import { useApi, type Equipment } from '../api'
import { useCurrentUser } from '../current-user'
import { formatDate } from '../dates'

/** days มาจาก backend (daysUntilDue) ไม่ใช้นาฬิกาของเครื่องผู้ใช้ */
function DueStatus({ days }: { days: number }) {
  if (days < 0) return <span className="badge danger">เลยกำหนด {-days} วัน</span>
  if (days <= 7) return <span className="badge warning">อีก {days} วัน</span>
  return <span className="muted">อีก {days} วัน</span>
}

export function EquipmentPage() {
  const { currentUser } = useCurrentUser()
  const { data, error } = useApi<Equipment[]>('/equipment', currentUser?.id ?? null)

  return (
    <section>
      <h1>รายการอุปกรณ์</h1>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">กำลังโหลด...</p>}
      {data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>ตำแหน่งติดตั้ง</th>
                <th>Criticality</th>
                <th>กำหนดตรวจสอบ</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.tagNo}</td>
                  <td>{e.name}</td>
                  <td>{e.location}</td>
                  <td>
                    <span className={`crit crit-${e.criticality}`}>{e.criticality}</span>
                  </td>
                  <td>
                    {formatDate(e.nextDueDate)}
                    {e.cycleOriginalDueDate && (
                      <div className="muted small">
                        เลื่อนจาก {formatDate(e.cycleOriginalDueDate)}
                      </div>
                    )}
                  </td>
                  <td>
                    <DueStatus days={e.daysUntilDue} />
                  </td>
                  <td>
                    {e.pendingRequestId ? (
                      <span className="muted small">
                        มีคำขอ #{e.pendingRequestId} รออนุมัติ
                      </span>
                    ) : (
                      <Link to={`/requests/new?equipmentId=${e.id}`}>ขอเลื่อน</Link>
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
