"use client";

import { useState } from "react";
import Link from "next/link";
import { useModalStore } from "@/store/modal.store";
import { useAuthStore } from "@/store/auth.store";
import { login, signup } from "@/lib/api/auth";
import { initializeWebSocket } from "@/lib/websocket";
import { Modal, ModalContent } from "@heroui/react";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import GoogleLoginButton from "@/components/ui/GoogleLogin";

interface AuthModalProps {
    type: "login" | "signup";
    onClose: () => void;
}

export default function AuthModal({ type, onClose }: AuthModalProps) {
    const { open, close } = useModalStore();
    const { setAuth, setLoading, isLoading } = useAuthStore();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isSignIn = type === "login";
    const isDisabled = isLoading || (!isSignIn && !agreeToTerms);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isDisabled) return;

        setError(null);
        setLoading(true);

        try {
            let response;
            if (isSignIn) {
                response = await login({ email, password, rememberMe });
            } else {
                // Get referral code from localStorage
                const referralCode = typeof window !== 'undefined' 
                    ? localStorage.getItem('referral_code') 
                    : null;

                console.log('Signup - referral code from localStorage:', referralCode);

                response = await signup({
                    email,
                    password,
                    agreeToTerms,
                    username: username?.trim().length ? username.trim() : undefined,
                    referredByCode: referralCode || undefined,
                });

                // Clear referral code after successful signup
                if (referralCode && typeof window !== 'undefined') {
                    localStorage.removeItem('referral_code');
                }
            }

            // Update auth state
            setAuth(response.user, response.token);
            
            // Connect WebSocket
            initializeWebSocket(response.token);
            
            // Close modal
            close();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSwitchMode = () => {
        const newType = isSignIn ? "signup" : "login";
        open(newType);
    };

    return (
        <Modal 
            isOpen={true} 
            onOpenChange={(open) => !open && onClose()}
            classNames={{
                base: "max-w-[361px] md:max-w-[360px] p-0 gap-0 bg-transparent border-0 shadow-none max-h-screen overflow-y-auto hide-scrollbar",
                backdrop: "bg-surface-overlay",
            }}
            hideCloseButton
        >
            <ModalContent className="bg-transparent border-0 shadow-none p-0">
                {() => (
                    <div className="flex flex-col items-center gap-[25px] md:gap-8 px-4 sm:px-0 py-4 sm:py-12">
                    {/* Logo */}
                    <div className="flex items-center">
                        <span className="text-base font-medium text-white leading-[16px]">
                            GalaxyBets
                        </span>
                    </div>

                    {/* Modal Container */}
                    <div className="flex flex-col items-center md:items-start p-5 gap-10 w-full bg-background-elevated border border-border-subtle rounded-[20px]">
                        {/* Header Section - gap 16px */}
                        <div className="flex flex-col items-start gap-4 w-full max-w-[329px] md:max-w-none">
                            {/* Title - gap 4px */}
                            <div className="flex flex-col gap-1">
                                <h2 className="text-lg font-medium leading-[20px] tracking-[-0.02em] text-white">
                                    {isSignIn ? "Welcome Back" : "Create Account"}
                                </h2>
                                <p className="text-sm font-medium leading-[15px] tracking-[-0.02em] text-text-muted">
                                    {isSignIn
                                        ? "Sign in to your account to continue"
                                        : "Create your account to get started!"}
                                </p>
                            </div>


                        </div>

                        {/* Form Section - gap 12px */}
                        <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-[329px] md:max-w-none">
                            {/* Hidden native submit enables Enter-to-submit reliably */}
                            <button
                                type="submit"
                                tabIndex={-1}
                                aria-hidden="true"
                                className="hidden"
                            />
                            {/* Username Field (Sign Up Only) */}
                            {!isSignIn && (
                                <Input
                                    type="text"
                                    autoComplete="username"
                                    label="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Choose a username"
                                    className="w-full"
                                />
                            )}
                            {/* Email Field */}
                            <Input
                                type="email"
                                required
                                autoComplete="email"
                                label="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                className="w-full"
                            />

                            {/* Password Field */}
                            <div className="flex flex-col gap-3">
                                <Input
                                    type="password"
                                    required
                                    autoComplete={isSignIn ? "current-password" : "new-password"}
                                    label="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full"
                                />

                                {/* Remember Me / Forgot Password - Sign In Only */}
                                {isSignIn && (
                                    <div className="flex flex-row justify-between items-center">
                                        <Checkbox
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            label="Remember Me"
                                        />
                                        <Link
                                            href="/forgot-password"
                                            onClick={() => { close(); onClose(); }}
                                            className="text-sm font-medium leading-[15px] tracking-[-0.02em] text-primary-400 hover:underline"
                                        >
                                            Forgot Password?
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="text-sm text-red-500 text-center">
                                    {error}
                                </div>
                            )}

                            {/* Submit Button Section - gap 16px */}
                            <div className="flex flex-col gap-4 w-full">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="md"
                                    disabled={isDisabled}
                                    className="w-full"
                                >
                                    {isSignIn ? "Sign In" : "Create Account"}
                                </Button>

                                {/* Terms Agreement - Sign Up Only */}
                                {/* {!isSignIn && ( */}
                                <div className="flex flex-row items-center gap-2">
                                    <Checkbox
                                        aria-label="I am at least 18 and agree to the Terms of Service"
                                        checked={agreeToTerms}
                                        onChange={(e) => setAgreeToTerms(e.target.checked)}
                                    />
                                    <span className="text-xs font-medium leading-[130%] tracking-[-0.02em] text-text-muted">
                                        By accessing this site, I attest that I am at least 18 years old and I agree to the{" "}
                                        <Link href="/terms" className="text-primary-400 underline">
                                            Terms of service
                                        </Link>
                                    </span>
                                </div>
                                {/* )} */}
                            </div>
                        </form>
                        <GoogleLoginButton mode={type} agreeToTerms={agreeToTerms} onSuccess={() => { close(); onClose(); }} />

                    </div>
                    {/* Footer Link - Desktop Only */}
                    <div className="hidden md:flex items-center gap-4 w-full justify-center">
                        <p className="text-sm font-medium leading-[15px] tracking-[-0.02em] text-text-muted text-center ">
                            {isSignIn ? "New to GalaxyBets?" : "Already a User?"}
                        </p>
                        <button type="button"
                            onClick={handleSwitchMode}
                            className={cn(
                                "flex flex-row justify-center items-center",
                                "text-primary-400",
                                "text-base font-medium leading-[17px] tracking-[-0.02em]",
                                "h-10 transition-colors hover:opacity-90 cursor-pointer underline"
                            )}
                        >
                            {isSignIn ? "Create Account" : "Sign In"}
                        </button>
                    </div>

                    {/* Mobile Footer Section - Only on mobile, below modal */}
                    <div className="flex md:hidden flex-col items-center gap-4 w-full max-w-[361px]">
                        <p className="text-sm font-medium leading-[15px] tracking-[-0.02em] text-text-muted text-center w-full">
                            {isSignIn ? "New to GalaxyBets?" : "Already a User?"}
                        </p>
                        <Button
                            type="button"
                            onClick={handleSwitchMode}
                            className={cn(
                                "flex flex-row justify-center items-center px-3 py-0.5 w-full rounded-full",
                                "bg-tab-active-bg text-white",
                                "text-base font-medium leading-[17px] tracking-[-0.02em]",
                                "h-10 transition-colors hover:opacity-90"
                            )}
                        >
                            {isSignIn ? "Create Account" : "Sign In"}
                        </Button>
                    </div>
                    </div>
                )}
            </ModalContent>
        </Modal>
    );
}
