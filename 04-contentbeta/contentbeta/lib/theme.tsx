'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ThemeContextType {
  isLight: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const light = stored !== 'dark'
    setIsLight(light)
    document.body.classList.toggle('light', light)
  }, [])

  function toggleTheme() {
    const newLight = !isLight
    setIsLight(newLight)
    document.body.classList.toggle('light', newLight)
    localStorage.setItem('theme', newLight ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ isLight, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
