"use client";
import {formatWalletBalance} from '@/lib/utils/wallet-display';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GameLinks } from "./GameLinks";
import styles from "./Navigation.module.css";
import { useModalStore } from "@/store/modal.store";
import { useAuthStore } from "@/store/auth.store";
import { getWalletBalance } from "@/lib/api/wallet";
import { navigationItems } from "@/lib/constants/navigation";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Button as HerouiButton, Image } from "@heroui/react";
import { cn } from "@/lib/utils/cn";

export function MobileMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const menuRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    useEffect(() => setIsOpen(false), [pathname]);
    useEffect(() => {
        if (!isOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        const keydown = (event: KeyboardEvent) => {
            if (event.key === "Escape") { event.preventDefault(); setIsOpen(false); }
            if (event.key !== "Tab") return;
            const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        const desktop = window.matchMedia("(min-width: 1280px)");
        const closeOnDesktop = () => { if (desktop.matches) setIsOpen(false); };
        desktop.addEventListener("change", closeOnDesktop);
        closeOnDesktop();
        document.addEventListener("keydown", keydown);
        return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); desktop.removeEventListener("change", closeOnDesktop); toggleRef.current?.focus(); };
    }, [isOpen]);
    const { open } = useModalStore();
    const { user, isAuthenticated, updateUser } = useAuthStore();

    const toggleMenu = () => setIsOpen(!isOpen);
    const closeMenu = () => setIsOpen(false);

    const handleSignIn = () => {
        open("login");
        closeMenu();
    };

    const handleSignUp = () => {
        open("signup");
        closeMenu();
    };

    const handleDeposit = async () => {
        open("deposit");
        closeMenu();
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
        closeMenu();
    };

    return (
        <>
            {/* Mobile Menu Toggle Button - Hamburger */}
            <button
                ref={toggleRef}
                onClick={toggleMenu}
                className="xl:hidden w-6 h-6 flex items-center justify-center relative"
                aria-label="Toggle menu"
                aria-controls="mobile-navigation"
                aria-expanded={isOpen}
            >
                {isOpen ? (
                    // Close icon (X) when menu is open
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-6 h-6"
                    >
                        <path
                            d="M18 6L6 18M6 6L18 18"
                            stroke="#6c6c71"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                ) : (
                    // Hamburger icon (3 lines) - matches Figma design
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-6 h-6"
                    >
                        {/* Top line - 16.67% from left/right, 16.67% from top, 75% from bottom */}
                        <rect
                            x="4"
                            y="4"
                            width="16"
                            height="2"
                            rx="1"
                            fill="#6c6c71"
                        />
                        {/* Middle line - 16.67% from left/right, 45.83% from top, 45.83% from bottom */}
                        <rect
                            x="4"
                            y="11"
                            width="16"
                            height="2"
                            rx="1"
                            fill="#6c6c71"
                        />
                        {/* Bottom line - 16.67% from left/right, 75% from top, 16.67% from bottom */}
                        <rect
                            x="4"
                            y="18"
                            width="16"
                            height="2"
                            rx="1"
                            fill="#6c6c71"
                        />
                    </svg>
                )}
            </button>

            {/* Mobile Menu Overlay */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 xl:hidden"
                        onClick={closeMenu}
                    />
                    <div id="mobile-navigation" ref={menuRef} role="dialog" aria-modal="true" aria-label="Navigation menu" className="fixed inset-0 xl:hidden flex flex-col bg-background-base" style={{ zIndex: 100 }}>
                        {/* Mobile Menu Header */}
                        <div className="flex flex-row justify-between items-center px-4 md:px-5 pt-4 pb-3 h-14 md:h-[60px] relative isolate">
                            <div className="flex items-center flex-none order-0 z-0" >
                                <span className="text-[16px] font-medium text-white leading-[15px]">GalaxyBets
                                </span>
                            </div>
                            <button
                                onClick={closeMenu}
                                className="w-6 h-6 flex items-center justify-center"
                                aria-label="Close menu"
                            >
                                {/* Close Icon (X) - matches Figma cancel-01 */}
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-6 h-6"
                                >
                                    {/* X shape - positioned at 20.83% from all sides */}
                                    <path
                                        d="M5 5L19 19M19 5L5 19"
                                        stroke="#6c6c71"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                        {/* Mobile Menu Content */}
                        <div className="flex-1 overflow-y-auto bg-background-base z-50">
                            <div className="flex flex-col min-h-full px-4 py-8 items-center z-50">
                                <div className="flex flex-col items-stretch w-full max-w-[361px] gap-10">
                                    {isAuthenticated && user ? (
                                        /* Authenticated User Actions - Mobile */
                                        <div className="flex flex-col items-stretch gap-4">
                                            {/* Cart Button */}
                                            <HerouiButton
                                                onPress={handleCart}
                                                className="flex flex-row items-center justify-center px-4 py-0.5 gap-1 h-10 bg-[rgba(63,71,84,0.12)] rounded-full hover:opacity-90 transition-opacity"
                                            >
                                                <Icon name="cart" className="w-4 h-4 shrink-0" />
                                                <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
                                                    Cart({user.cartCount || 0})
                                                </span>
                                            </HerouiButton>

                                            {/* Deposit Button */}
                                            {user.walletBalance && Number(String(user.walletBalance).replace(/[^0-9.-]+/g, "")) > 0 ? (
                                                <HerouiButton
                                                    onPress={handleDeposit}
                                                    className="flex flex-row items-center justify-center px-4 py-0.5 gap-1 h-10 bg-[rgba(63,71,84,0.12)] rounded-full hover:opacity-90 transition-opacity"
                                                >
                                                    <Icon name="wallet" className="w-4 h-4 shrink-0" />
                                                    <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
                                                        {formatWalletBalance(user.walletBalance ?? user.balance)}
                                                    </span>
                                                </HerouiButton>
                                            ) : (
                                                <Button
                                                    onClick={handleDeposit}
                                                    variant="primary"
                                                    size="md"
                                                    className="w-full h-10 flex flex-row items-center justify-center gap-1"
                                                >
                                                    <Icon name="wallet" className="w-4 h-4 shrink-0" isActive={true} />
                                                    <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
                                                        Deposit
                                                    </span>
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        /* Authentication Buttons Section - gap 16px */
                                        <div className="flex flex-col items-stretch gap-4">
                                            {/* Sign In Button */}
                                            <Button
                                                onClick={handleSignIn}
                                                className={cn(
                                                    "flex flex-row justify-center items-center px-3 py-0.5 h-10 rounded-full",
                                                    "bg-tab-active-bg text-white",
                                                    "text-base font-medium leading-[17px] tracking-[-0.02em]",
                                                    "transition-colors hover:opacity-90"
                                                )}
                                            >
                                                Sign In
                                            </Button>

                                            {/* Create Account Button */}
                                            <Button
                                                onClick={handleSignUp}
                                                variant="primary"
                                                size="md"
                                                className="w-full"
                                            >
                                                Create Account
                                            </Button>
                                        </div>
                                    )}

                                    <section className={styles.mobileGames} aria-label="Games">
                                        <h2 className={styles.dropdownLabel}>Games</h2>
                                        <GameLinks pathname={pathname} onNavigate={closeMenu}/>
                                    </section>

                                    {user?.role === "STREAMER" && <Link href="/streamer" onClick={closeMenu} className="text-center text-purple-300">Streamer dashboard</Link>}
                                    {/* Navigation Items Section - gap 20px */}
                                    <div className="flex flex-col items-stretch gap-5">
                                        {navigationItems.map((item) => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                aria-current={pathname === item.href || pathname.startsWith(item.href + "/") ? "page" : undefined}
                                                onClick={closeMenu}
                                                className={cn(
                                                    "flex flex-row justify-center items-center px-3 py-0.5 h-10 rounded-full",
                                                    "text-white hover:bg-tab-active-bg transition-colors",
                                                    "text-base font-medium leading-[17px] tracking-[-0.02em]"
                                                )}
                                            >
                                                <span>{item.label}</span>
                                                {item.icon && (
                                                    <Icon name={item.icon} isActive={true} size="md" className="ml-1" />
                                                )}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
