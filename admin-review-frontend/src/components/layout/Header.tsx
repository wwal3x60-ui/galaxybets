"use client";
import BalanceCapsule from './BalanceCapsule';

import { useState } from "react";
import { Logo } from "./Logo";
import { Navigation } from "./Navigation";
import { MobileMenu } from "./MobileMenu";
import { UserMenu } from "./UserMenu";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Button as HerouiButton, Image } from "@heroui/react";
import { useModalStore } from "@/store/modal.store";
import { useAuthStore } from "@/store/auth.store";
import { getWalletBalance } from "@/lib/api/wallet";

import {useCommunityStore} from '@/store/community.store';
export function Header() {
  const { open } = useModalStore();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const showCommunity=useCommunityStore(state=>state.show);
  const handleWallet=()=>showCommunity('wallet');
  const handleGetStarted = () => {
    open("login");
  };

  const handleDeposit = async () => {
    open("deposit");
    if (isAuthenticated) {
      try {
        const wallet = await getWalletBalance();
        if (wallet?.balance != null) updateUser({ walletBalance: wallet.balance });
      } catch {
        // ignore; modal will refetch on open
      }
    }

  };

  const handleCart = () => {
    open("cart");
  };

  const handleAvatarClick = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  return (
    <>
    <header className="relative w-full bg-background-base border-b border-border-subtle z-50">
      <div className="w-full max-w-[1440px] mx-auto">
        <div className="flex flex-row justify-between items-center px-3 sm:px-4 md:px-5 pt-4 pb-3 h-14 md:h-[60px] relative isolate gap-2 sm:gap-4">
          {/* Logo */}
          <Logo className="flex-none order-0 z-0" />

          {/* Centered Navigation - Desktop */}
          <Navigation className="hidden xl:flex" />

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 flex-none order-1 z-1">
            {isAuthenticated && user ? (
              /* Authenticated User Actions - Desktop */
              <div className="hidden xl:flex flex-row items-center  gap-1 h-8">
                {/* Cart Button */}
                <HerouiButton
                  onPress={handleCart}
                  className="flex flex-row items-center px-4 py-0.5 gap-1  h-8 bg-highlight rounded-full hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Icon name="cart" className="shrink-0" size="lg" />
                  <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white shrink-0">
                    Cart({user.cartCount || 0})
                  </span>
                </HerouiButton>

                {/* Deposit Button */}
                <BalanceCapsule balance={user.walletBalance ?? user.balance} onWallet={handleWallet} onDeposit={handleDeposit} />

                {/* User Avatar with Menu */}
                <div className="relative">
                  <div
                    onClick={handleAvatarClick}
                    className="w-8 h-8 rounded-full overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <Image
                      src={user.avatar || "/assets/avatar/avatar (1).png"}
                      alt={user.name}
                      className="w-full object-cover rounded-full"
                    />
                  </div>
                  <UserMenu
                    isOpen={isUserMenuOpen}
                    onClose={() => setIsUserMenuOpen(false)}
                    onDeposit={handleDeposit}
                  />
                </div>
              </div>
            ) : (
              /* Get Started Button - Desktop */
              <Button
                onClick={handleGetStarted}
                variant="primary"
                size="md"
                className="hidden xl:flex bg-button-primary hover:bg-button-hover"
              >
                Get Started
              </Button>
            )}

            {isAuthenticated&&user&&<div className="xl:hidden"><BalanceCapsule compact balance={user.walletBalance ?? user.balance} onWallet={handleWallet} onDeposit={handleDeposit} /></div>}
            {/* Mobile Menu Toggle */}
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>

    </>
  );
}
