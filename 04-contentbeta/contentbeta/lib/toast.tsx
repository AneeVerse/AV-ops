'use client'
import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

interface ToastContextType {
  showToast: (msg: string, error?: boolean) => void
}

interface ToastState {
  message: string
  error: boolean
  visible: boolean
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: '', error: false, visible: false })

  const showToast = useCallback((msg: string, error = false) => {
    setToast({ message: msg, error, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast${toast.visible ? ' show' : ''}${toast.error ? ' error' : ''}`}>
        {toast.message}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
