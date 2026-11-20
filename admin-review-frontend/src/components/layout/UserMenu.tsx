"use client";
import {formatWalletBalance} from '@/lib/utils/wallet-display';

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Image } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { useAuthStore } from "@/store/auth.store";
import { logout } from "@/lib/api/auth";

interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onDeposit?: () => void;
}

export function UserMenu({ isOpen, onClose, onDeposit }: UserMenuProps) {
  const { user, logout: logoutUser } = useAuthStore();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-account-toggle]')) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleViewProfile = () => {
    router.push("/account/profile");
    onClose();
  };

  const handleDeposit = () => {
    onDeposit?.();
    onClose();
  };

  const handleSignOut = async () => {
    try {
      await logout();
      logoutUser();
      onClose();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div data-account-menu="galaxy-account-v1"
      ref={menuRef}
      className="absolute right-0 top-full mt-2 w-[204px] min-h-[228px] bg-[#1e1f23] border border-[rgba(63,71,84,0.24)] rounded-lg shadow-[0px_0px_20px_4px_rgba(0,0,0,0.4)] flex flex-col items-start p-0.5 gap-1 z-50"
    >
      {/* User Profile Section */}
      <div data-account-summary="true" className="w-full  bg-[rgba(63,71,84,0.12)] rounded-md flex flex-col justify-between items-center p-3 gap-2">
        {/* Left side: Avatar and Name */}
        <div className="flex flex-col items-center gap-1 w-11 ">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
            <Image
              src={user.avatar || "/assets/avatar/avatar (1).png"}
              alt={user.name || user.username}
              width={32}
              height={32}
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          {/* User Name */}
          <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white/92">
            {user.name || user.username}
          </span>
        </div>
        {/* Right side: Wallet Balance */}
        <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-[#6c6c71] shrink-0">
          {formatWalletBalance(user.walletBalance ?? user.balance)}
        </span>
      </div>

      {/* Menu Items */}
      {['ADMIN','OWNER','DEV'].includes(user.role||'')&&<Button onPress={()=>{router.push('/admin');onClose()}} className="w-full bg-transparent text-white">Administration</Button>}
      <div data-account-actions="true" className="flex flex-col items-start gap-0.5 h-auto w-full">
        {/* View Profile */}
        <Button data-account-dashboard="true" onPress={()=>{router.push('/account/dashboard');onClose()}} className="w-full bg-transparent text-white">Dashboard</Button>


        {/* Deposit */}
        <Button
          onPress={handleDeposit}
          className="flex flex-row justify-between items-center px-2.5 py-2 gap-2 w-full h-8 rounded-md bg-transparent hover:bg-[rgba(63,71,84,0.12)] transition-colors cursor-pointer"
        >
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white/92">
            Deposit
          </span>
          <Icon name="arrow-down-left" className="w-4 h-4 shrink-0" />
        </Button>

        {user.role==='AFFILIATE_MANAGER'&&<Button onPress={()=>{router.push('/manager');onClose()}} className="w-full bg-transparent text-white">Manager dashboard</Button>}
        {user.role==='STREAMER'&&<Button onPress={()=>{router.push('/streamer');onClose()}} className="w-full bg-transparent text-white">Streamer dashboard</Button>}
        {/* Sign Out */}
        <Button
          onPress={handleSignOut}
          className="flex flex-row justify-between items-center px-2.5 py-2 gap-2 w-full h-8 rounded-md bg-transparent hover:bg-[rgba(63,71,84,0.12)] transition-colors cursor-pointer"
        >
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white/92">
            Sign Out
          </span>
          <Icon name="logout-05" className="w-4 h-4 shrink-0" />
        </Button>
      </div>
    </div>
  );
}
