import { create } from "zustand"

interface UIState {
  sidebarOpen: boolean
  activeDialog: string | null
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  openDialog: (id: string) => void
  closeDialog: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  activeDialog: null,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openDialog: (id) => set({ activeDialog: id }),
  closeDialog: () => set({ activeDialog: null }),
}))
