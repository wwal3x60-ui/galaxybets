"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { adminError, getAdminUsers, getAdminUser, updateAdminUser, type AdminUser, type AdminProfile, type UserChanges, type UserPage } from "@/lib/api/admin";

const input = "w-full min-w-0 rounded-lg border border-border-subtle bg-surface-primary px-3 py-2 text-sm text-white";
const money = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
const flags = [["banned", "Banned"], ["rainBan", "Rain ban"], ["tipBan", "Tip ban"], ["leaderboardBan", "Leaderboard ban"], ["accountLock", "Lock account"], ["sponsorLock", "Sponsor lock"]] as const;
const numbers = [
  ["balance", "Set balance", 35000, false], ["muteSeconds", "Mute seconds (0 to unmute)", 100000000, false],
  ["maxPerTip", "Maximum per tip", 350000, true], ["maxTipPerUser", "Maximum tip per user", 350000, true],
  ["tipAllowance", "Tip allowance", 350000, true], ["rainTipAllowance", "Rain tip allowance", 350000, true],
  ["cryptoAllowance", "Crypto allowance", 350000, true], ["xp", "Set XP", 100000000, false]
] as const;

export default function AdminUsers({ token, profile, onSelfChanged }: { token: string; profile: AdminProfile; onSelfChanged?: () => void }) {
  const [page, setPage] = useState(1), [search, setSearch] = useState(""), [draft, setDraft] = useState("");
  const [sort, setSort] = useState("balance"), [order, setOrder] = useState("DESC"), [refresh, setRefresh] = useState(0);
  const [users, setUsers] = useState<UserPage | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null), [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const alive = useRef(true), detailVersion = useRef(0), mutation = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; detailVersion.current++; }; }, []);
  useEffect(() => {
    let active = true; setLoading(true); setError(""); setUsers(null);
    getAdminUsers(token, page, search, sort, order).then(data => { if (active) setUsers(data); }).catch(e => { if (active) setError(adminError(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, page, search, sort, order, refresh]);
  useEffect(() => {
    if (detailLoading || selected?.id != null || message) {
      editor.current?.focus({ preventScroll: true });
      editor.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [detailLoading, selected?.id, message]);
  async function view(id: string | number) {
    const version = ++detailVersion.current; setSelected(null); setDetailLoading(true); setMessage("");
    try { const user = await getAdminUser(token, id); if (alive.current && version === detailVersion.current) setSelected(user); }
    catch (e) { if (alive.current && version === detailVersion.current) setMessage(`Could not open account #${id}. ${adminError(e)}${(e as { response?: { status?: number } }).response?.status ? ` (HTTP ${(e as { response?: { status?: number } }).response?.status})` : ""}`); }
    finally { if (alive.current && version === detailVersion.current) setDetailLoading(false); }
  }
  async function save(changes: UserChanges, description: string) {
    if (!selected || mutation.current) return;
    const user = selected;
    const extra = changes.sponsorLock === true ? " This also deletes this user's referral association." : "";
    if (!window.confirm(`${description} for ${user.username} (#${user.id})?${extra}`)) return;
    mutation.current = true; setBusy(true); setMessage("");
    try {
      await updateAdminUser(token, user.id, changes);
      if (!alive.current) return;
      setSelected(null); setMessage("Saved successfully. Open the user again to view the latest values."); setRefresh(n => n + 1);
      if (String(user.id) === profile.id && changes.role) onSelfChanged?.();
    } catch (e) { if (alive.current) { setSelected(null); setMessage(adminError(e) + " Open the user again to check current values before retrying."); } }
    finally { mutation.current = false; if (alive.current) setBusy(false); }
  }
  const locked = selected?.role === "OWNER" && String(selected.id) !== profile.id;
  return <section className="space-y-5 rounded-2xl border border-border-subtle bg-background-elevated p-4 sm:p-6">
    <header className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Users</h2><p className="mt-1 text-xs text-text-muted">Search accounts and manage server-supported settings.</p></div><Button isDisabled={busy} onPress={() => setRefresh(n => n + 1)} className="bg-highlight text-white">Refresh</Button></header>
    <form onSubmit={e => { e.preventDefault(); setPage(1); setSearch(draft.trim()); setRefresh(n => n + 1); }} className="flex flex-wrap gap-2">
      <label className="min-w-0 flex-1 text-xs text-text-muted">Username<input aria-label="Search username" maxLength={30} value={draft} onChange={e => setDraft(e.target.value)} className={input} placeholder="Search users…" /></label>
      <Button type="submit" className="self-end bg-button-primary text-white">Search</Button>
      <label className="text-xs text-text-muted">Sort by<select aria-label="Sort users" className={input} value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="balance">Balance</option><option value="username">Username</option><option value="xp">XP</option></select></label>
      <label className="text-xs text-text-muted">Order<select aria-label="Sort direction" className={input} value={order} onChange={e => { setOrder(e.target.value); setPage(1); }}><option value="DESC">Descending</option><option value="ASC">Ascending</option></select></label>
    </form>
    <div ref={editor} tabIndex={-1} aria-label="Account management" className="scroll-mt-28 space-y-3 outline-none">
    {message && <p role="status" className="rounded-xl bg-highlight p-3 text-sm text-white">{message}</p>}
    {detailLoading && <p role="status" className="text-sm text-text-muted">Loading account…</p>}
    {selected && <div className="rounded-xl border border-border-subtle bg-surface-primary p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold text-white">{selected.username} · #{selected.id}</h3><Button size="sm" isDisabled={busy} onPress={() => { detailVersion.current++; setSelected(null); }} className="bg-highlight text-white">Close</Button></div>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Balance", selected.balance], ["Wagered", selected.wagered], ["Deposited (legacy)", selected.deposits], ["Withdrawn (legacy)", selected.withdraws]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-highlight p-3"><p className="text-xs text-text-muted">{label}</p><p className="mt-2 text-sm font-semibold text-white">{value == null ? "Unavailable" : money(Number(value))}</p></div>)}</div>
      <p className="mb-4 text-xs text-text-muted">Deposit/withdrawal totals come from the existing user endpoint and may exclude manual crypto transactions.</p>
      {locked ? <p className="text-sm text-text-muted">The backend protects other OWNER accounts from edits.</p> : <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
        {flags.map(([field, label]) => <div key={field} className="flex items-center justify-between gap-3 rounded-lg bg-highlight p-3"><span className="text-sm text-white">{label}: {selected[field] ? "On" : "Off"}</span><Button size="sm" isDisabled={busy || (field === "banned" && String(selected.id) === profile.id && !selected.banned)} onPress={() => void save({ [field]: !selected[field] }, `${selected[field] ? "Disable" : "Enable"} ${label.toLowerCase()}`)} className="bg-button-primary text-white">{selected[field] ? "Disable" : "Enable"}</Button></div>)}
        <RoleControl key={`role-${selected.id}`} user={selected} profile={profile} busy={busy} save={save} />
        {numbers.map(([field, label, max, nullable]) => <NumberControl key={`${selected.id}-${field}`} label={label} value={selected[field]} max={max} nullable={nullable} busy={busy} onSave={value => void save({ [field]: value }, `${label} to ${value === null ? "unset" : value}`)} />)}
      </fieldset>}
    </div>}
    </div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {loading ? <p role="status" className="text-sm text-text-muted">Loading users…</p> : users && <>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-text-muted"><tr>{["User", "ID", "Role", "Balance", ""].map((t, i) => <th key={i} className="p-3">{t}</th>)}</tr></thead><tbody>{users.data.map(user => <tr key={user.id} className="border-t border-border-subtle"><td className="max-w-44 break-words p-3 font-semibold text-white">{user.username}</td><td className="p-3 text-text-muted">#{user.id}</td><td className="p-3 text-text-muted">{user.role}</td><td className="whitespace-nowrap p-3 text-white">{money(user.balance)}</td><td className="p-3"><Button size="sm" isDisabled={busy || detailLoading} onPress={() => void view(user.id)} className="bg-highlight text-white">Manage</Button></td></tr>)}</tbody></table></div>
      {!users.data.length && <p className="text-sm text-text-muted">No users found.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted"><span>{users.total} accounts · Page {users.pages ? users.page : 0} of {users.pages}</span><div className="flex gap-2"><Button size="sm" isDisabled={page <= 1 || busy} onPress={() => setPage(n => n - 1)} className="bg-highlight text-white">Previous</Button><Button size="sm" isDisabled={!users.pages || page >= users.pages || busy} onPress={() => setPage(n => n + 1)} className="bg-highlight text-white">Next</Button></div></div>
    </>}

  </section>;
}
function NumberControl({ label, value, max, nullable, busy, onSave }: { label: string; value: number | null | undefined; max: number; nullable: boolean; busy: boolean; onSave: (value: number | null) => void }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  return <form onSubmit={e => { e.preventDefault(); const n = text.trim() === "" ? null : Number(text); if ((n === null && nullable) || (n !== null && Number.isFinite(n) && n >= 0 && n <= max)) onSave(n); }} className="flex flex-wrap items-end gap-2 rounded-lg bg-highlight p-3"><label className="min-w-0 flex-1 text-sm text-white">{label}<input className={input + " mt-2"} type="number" step="any" min={0} max={max} required={!nullable} disabled={busy} value={text} onChange={e => setText(e.target.value)} />{nullable && <span className="text-xs text-text-muted">Leave empty to unset.</span>}</label><Button type="submit" isDisabled={busy} size="sm" className="bg-button-primary text-white">Update</Button></form>;
}
function RoleControl({ user, profile, busy, save }: { user: AdminUser; profile: AdminProfile; busy: boolean; save: (changes: UserChanges, description: string) => Promise<void> }) {
  const [role, setRole] = useState(user.role);
  const roles = ["USER", "STREAMER", "AFFILIATE_MANAGER", "MOD", "DEV", "ADMIN", ...(profile.role === "OWNER" ? ["OWNER"] : [])];
  return <form className="flex flex-wrap items-end gap-2 rounded-lg bg-highlight p-3" onSubmit={e => { e.preventDefault(); if (roles.includes(role)) void save({ role }, `Change role from ${user.role} to ${role}`); }}><label className="min-w-0 flex-1 text-sm text-white">Role<select aria-label="Role" value={role} disabled={busy} onChange={e => setRole(e.target.value)} className={input + " mt-2"}>{!roles.includes(user.role) && <option disabled value={user.role}>{user.role} (current)</option>}{roles.map(r => <option key={r}>{r}</option>)}</select></label><Button type="submit" isDisabled={busy || role === user.role || !roles.includes(role)} size="sm" className="bg-button-primary text-white">Update role</Button></form>;
}
