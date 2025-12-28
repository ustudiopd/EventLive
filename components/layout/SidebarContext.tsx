'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface SidebarContextType {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  sidebarWidth: number
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  // 사이드바 접기 기능 제거 - 항상 펼쳐진 상태로 유지
  const isCollapsed = false
  const sidebarWidth = 256 // 16 * 16 = 256px

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed: () => {}, sidebarWidth }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}




