"use client"

import React, { createContext, useContext, useState } from "react"

interface ModalContextType {
  isModalOpen: boolean
  setIsModalOpen: (isOpen: boolean) => void
  close: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export const ModalProvider: React.FC<{ children: React.ReactNode; close?: () => void }> = ({ children, close: closeProp }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const close = () => {
    if (closeProp) {
      closeProp()
    } else {
      setIsModalOpen(false)
    }
  }

  return (
    <ModalContext.Provider value={{ isModalOpen, setIsModalOpen, close }}>
      {children}
    </ModalContext.Provider>
  )
}

export const useModal = () => {
  const context = useContext(ModalContext)
  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider")
  }
  return context
}
