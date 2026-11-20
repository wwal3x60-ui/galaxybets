"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminCashier from "@/components/admin/AdminCashier";
import { useAuthStore } from "@/store/auth.store";
import { useModalStore } from "@/store/modal.store";
import { adminError, getAdminDashboard, getAdminProfile, type AdminDashboard, type AdminProfile } from "@/lib/api/admin";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function AdminPanel({ section = "dashboard" }: { section?: "dashboard" | "users" | "cashier" }) {
  const { token, hasHydrated, isAuthenticated } = useAuthStore();
  const { open } = useModalStore();
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const version = useRef(0);

  useEffect(() => {
    const request = ++version.current;
    setVerifiedToken(null); setProfile(null); setDashboard(null); setError(null); setStatsError(null); setLoading(true);
    if (!hasHydrated) return;
    if (!token || !isAuthenticated) { setLoading(false); return; }
    void (async () => {
      try {
        // Verify the role from the backend, rather than a saved browser profile.
        const currentProfile = await getAdminProfile(token);
        if (request !== version.current) return;
        setProfile(currentProfile); setVerifiedToken(token);
        try {
          if (section !== "dashboard") return;
          const stats = await getAdminDashboard(token);
          if (request === version.current) setDashboard(stats);
        } catch (failure) {
          if (request === version.current) setStatsError(adminError(failure));
        }
      } catch (failure) {
        if (request === version.current) setError(adminError(failure));
      } finally {
        if (request === version.current) setLoading(false);
      }
    })();
    return () => { version.current += 1; };
  }, [token, hasHydrated, isAuthenticated, refresh, section]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-5 sm:py-10">
      <Link href="/" className="text-xs text-text-muted hover:text-white">← Back to GalaxyBets</Link>
      <header className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-ancient-purple">GalaxyBets</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Admin panel</h1>
        </div>
        {profile && <span className="rounded-full border border-border-subtle bg-highlight px-3 py-2 text-[10px] font-semibold text-white">{profile.role}</span>}
      </header>

      {!hasHydrated || loading || (profile && verifiedToken !== token) ? (
        <section role="status" className="rounded-2xl border border-border-subtle bg-background-elevated p-6 text-sm text-text-muted">{profile ? "Loading dashboard…" : "Checking admin access…"}</section>
      ) : !token || !isAuthenticated ? (
        <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6">
          <h2 className="text-lg font-semibold text-white">Log in to continue</h2>
          <p className="mt-2 text-sm text-text-muted">Use your GalaxyBets administrator account.</p>
          <Button onPress={() => open("login")} className="mt-5 bg-button-primary font-semibold text-white">Log in</Button>
        </section>
      ) : !profile ? (
        <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6">
          <h2 className="text-lg font-semibold text-white">Admin access unavailable</h2>
          <p role="status" className="mt-2 text-sm text-text-muted">{error || "Could not verify this account's admin access."}</p>
          <Button onPress={() => setRefresh((n) => n + 1)} className="mt-5 bg-button-primary text-white">Check again</Button>
        </section>
      ) : (
        <>
          <nav aria-label="Admin sections" className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-border-subtle bg-background-elevated p-2">
            {(["dashboard", "users", "cashier"] as const).map((item) => <Link key={item} href={item === "dashboard" ? "/admin" : `/admin/${item}`} aria-current={section === item ? "page" : undefined} className={`flex-1 rounded-xl px-3 py-3 text-center text-sm font-semibold capitalize ${section === item ? "bg-button-primary text-white" : "text-text-muted hover:bg-highlight hover:text-white"}`}>{item}</Link>)}
          <Link href="/admin/managers" className="flex-1 rounded-xl px-3 py-3 text-center text-sm font-semibold text-text-muted hover:bg-highlight hover:text-white">Managers</Link></nav>
          {section === "users" ? <AdminUsers key={token} token={token} profile={profile} onSelfChanged={() => setRefresh(n => n + 1)} /> : section === "cashier" ? <AdminCashier key={token} token={token} /> : (

          <section className="rounded-2xl border border-border-subtle bg-background-elevated p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Dashboard overview</h2>
                <p className="mt-1 text-xs text-text-muted">{profile.username} · Account #{profile.id}</p>
              </div>
              <Button size="sm" variant="flat" onPress={() => setRefresh((n) => n + 1)} className="bg-highlight text-white">Refresh</Button>
            </div>
            {dashboard ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Net deposits · 24 hours", value: dashboard.day },
                  { label: "Net deposits · 7 days", value: dashboard.week },
                  { label: "Net deposits · 31 days", value: dashboard.month },
                  { label: "Net deposits · all time", value: dashboard.total },
                ].map((stat) => (
                  <div key={stat.label} className="min-w-0 rounded-xl border border-border-subtle bg-surface-primary p-4">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">{stat.label}</p>
                    <p className={`mt-3 break-all text-lg font-bold tabular-nums ${stat.value < 0 ? "text-error-base" : "text-white"}`}>{money(stat.value)}</p>
                  </div>
                ))}
              </div>
            ) : <p role="status" className="text-sm leading-relaxed text-text-muted">{statsError || "Statistics are not available."}</p>}
          </section>
          )}
        </>
      )}
    </main>
  );
}
