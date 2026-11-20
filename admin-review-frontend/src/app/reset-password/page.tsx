import type { Metadata } from "next";
import ResetPassword from "./reset-password";
export const metadata: Metadata = { title: "Choose a new password | GalaxyBets", referrer: "no-referrer", robots: { index: false, follow: false } };
export default function ResetPasswordPage(){return <ResetPassword />;}
