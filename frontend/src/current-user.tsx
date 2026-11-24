import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type User } from './api'

const STORAGE_KEY = 'currentUserId'

interface CurrentUserState {
  users: User[]
  currentUser: User | null
  setCurrentUserId: (id: number) => void
}

const CurrentUserContext = createContext<CurrentUserState | null>(null)

function readStoredId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

/** ไม่มีระบบ login: ให้เลือกผู้ใช้จาก dropdown แล้วจำไว้ใน localStorage */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([])
  const [currentUserId, setId] = useState<number | null>(readStoredId)

  useEffect(() => {
    api<User[]>('/users', null)
      .then(setUsers)
      .catch(() => setUsers([]))
  }, [])

  const setCurrentUserId = (id: number) => {
    setId(id)
    try {
      localStorage.setItem(STORAGE_KEY, String(id))
    } catch {
      // เบราว์เซอร์บล็อก storage ก็ยังใช้งานต่อได้ แค่ไม่จำค่า
    }
  }

  const currentUser =
    users.find((u) => u.id === currentUserId) ?? users[0] ?? null

  return (
    <CurrentUserContext.Provider value={{ users, currentUser, setCurrentUserId }}>
      {children}
    </CurrentUserContext.Provider>
  )
}

// eslint-disable-next-line react/only-export-components
export function useCurrentUser(): CurrentUserState {
  const value = useContext(CurrentUserContext)
  if (!value) throw new Error('useCurrentUser ต้องอยู่ใน CurrentUserProvider')
  return value
}
