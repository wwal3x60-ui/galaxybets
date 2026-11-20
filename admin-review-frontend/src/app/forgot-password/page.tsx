import type { Metadata } from "next";
import PasswordRecovery from "./password-recovery";
export const metadata: Metadata = { title: "Reset your password | GalaxyBets", referrer: "no-referrer", robots: { index: false, follow: false } };
export default function ForgotPasswordPage() { return <PasswordRecovery />; }
