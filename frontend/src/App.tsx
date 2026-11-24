import { NavLink, Route, Routes } from 'react-router'
import { ROLE_LABEL } from './api'
import { CurrentUserProvider, useCurrentUser } from './current-user'
import { EquipmentPage } from './pages/EquipmentPage'
import { NewRequestPage } from './pages/NewRequestPage'
import { PendingPage } from './pages/PendingPage'

function UserSwitcher() {
  const { users, currentUser, setCurrentUserId } = useCurrentUser()
  if (users.length === 0) {
    return <span className="error small">เชื่อมต่อ backend ไม่ได้</span>
  }
  return (
    <label className="user-switcher">
      ผู้ใช้
      <select
        value={currentUser?.id ?? ''}
        onChange={(e) => setCurrentUserId(Number(e.target.value))}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.fullName} ({ROLE_LABEL[u.role]})
          </option>
        ))}
      </select>
    </label>
  )
}

function Layout() {
  const { currentUser } = useCurrentUser()
  return (
    <>
      <header>
        <nav>
          <NavLink to="/" end>
            อุปกรณ์
          </NavLink>
          <NavLink to="/requests/new">ยื่นคำขอ</NavLink>
          <NavLink to="/requests/pending">รออนุมัติ</NavLink>
        </nav>
        <UserSwitcher />
      </header>
      <main>
        {/* key ทำให้ฟอร์มและข้อความรีเซ็ตเมื่อสลับผู้ใช้ */}
        <Routes key={currentUser?.id}>
          <Route path="/" element={<EquipmentPage />} />
          <Route path="/requests/new" element={<NewRequestPage />} />
          <Route path="/requests/pending" element={<PendingPage />} />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <CurrentUserProvider>
      <Layout />
    </CurrentUserProvider>
  )
}
