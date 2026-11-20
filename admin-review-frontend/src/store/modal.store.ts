// store/modal.store.ts
import { create } from 'zustand'

type ModalType =
  | 'login'
  | 'signup'
  | 'delete-confirm'
  | 'pack-item'
  | 'deposit'
  | 'cart'
  | 'withdraw'
  | 'jackpot'
  | null

interface ModalState {
  modal: ModalType
  modalProps?: Record<string, any>
  open: (modal: ModalType, props?: Record<string, any>) => void
  close: () => void
}

export const useModalStore = create<ModalState>((set) => ({
  modal: null,
  modalProps: {},
  open: (modal, modalProps = {}) => set({ modal, modalProps }),
  close: () => set({ modal: null, modalProps: {} }),
}))
