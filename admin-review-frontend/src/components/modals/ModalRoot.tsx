// components/modals/ModalRoot.tsx
'use client'

import { useModalStore } from '@/store/modal.store'
import dynamic from 'next/dynamic'
const AuthModal = dynamic(() => import('./AuthModal'), { ssr: false })
const PackItemModal = dynamic(() => import('./PackItemModal'), { ssr: false })
const CashierModal = dynamic(() => import('./CashierModal'), { ssr: false })
const CartModal = dynamic(() => import('./CartModal'), { ssr: false })
const WithdrawModal = dynamic(() => import('./WithdrawModal'), { ssr: false })
const JackpotModal = dynamic(() => import('./JackpotModal'), { ssr: false })

export default function ModalRoot() {
  const { modal, modalProps, close } = useModalStore()

  if (!modal) return null

  return (
    <>
      {(modal === 'login' || modal === 'signup') && (
        <AuthModal type={modal === 'login' ? 'login' : 'signup'} onClose={close} />
      )}
      {modal === 'pack-item' && (
        <PackItemModal />
      )}
      {modal === 'deposit' && (
        <CashierModal onClose={close} />
      )}
      {modal === 'cart' && (
        <CartModal onClose={close} />
      )}
      {modal === 'withdraw' && (
        modalProps?.cartItemIds?.length ? <WithdrawModal
          onClose={close}
          totalAmount={modalProps?.totalAmount || 0}
          cartItemIds={modalProps?.cartItemIds || []}
        /> : <CashierModal initialTab="withdraw" onClose={close} />
      )}
      {modal === 'jackpot' && (
        <JackpotModal
          onClose={close}
          segments={modalProps?.segments || []}
          badges={modalProps?.badges || []}
          ticketNumber={modalProps?.ticketNumber}
          winnerId={modalProps?.winnerId}
          spinDurationMs={modalProps?.spinDurationMs}
          onFinished={modalProps?.onFinished}
        />
      )}
    </>
  )
}
