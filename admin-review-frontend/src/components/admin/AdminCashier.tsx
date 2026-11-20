"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { adminError, getPendingTransactions, processTransaction, type CashierTransaction } from "@/lib/api/admin";
import { withdrawalCoin } from "@/lib/withdrawal-coins";
const money = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
type Review = { transaction: CashierTransaction; reject: boolean };
export default function AdminCashier({ token }: { token: string }) {
  const [rows, setRows] = useState<CashierTransaction[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [review, setReview] = useState<Review | null>(null), [hash, setHash] = useState("");
  const [refresh, setRefresh] = useState(0);
  const alive = useRef(true), mutation = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true; setLoading(true); setError(""); setRows([]); setReview(null);
    getPendingTransactions(token).then(data => { if (active) setRows(data); }).catch(e => { if (active) setError(adminError(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, refresh]);
  async function submit() {
    if (!review || mutation.current || error || hash.length > 255) return;
    const { transaction, reject } = review;
    const action = reject ? "reject" : transaction.type === "crypto_deposit" ? "approve-deposit" : "approve-withdraw";
    mutation.current = true; setBusy(true); setMessage("");
    try {
      await processTransaction(token, action, transaction.id, !reject && action === "approve-withdraw" ? hash : undefined);
      if (!alive.current) return;
      setReview(null); setRows(old => old.filter(row => row.id !== transaction.id));
      setMessage(`Transaction #${transaction.id} ${reject ? "rejected" : "approved"}.`);
      setRefresh(n => n + 1);
    } catch (e) {
      if (alive.current) { setReview(null); setError(adminError(e) + " Refresh the queue to check its status before retrying."); }
    } finally { mutation.current = false; if (alive.current) setBusy(false); }
  }
  return <section className="space-y-5 rounded-2xl border border-border-subtle bg-background-elevated p-4 sm:p-6">
    <header className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Cashier</h2><p className="mt-1 text-xs text-text-muted">Pending crypto deposits and withdrawals.</p></div><Button isDisabled={busy} onPress={() => setRefresh(n => n + 1)} className="bg-highlight text-white">Refresh</Button></header>
    <p className="rounded-xl bg-highlight p-3 text-sm text-text-muted">Verify deposits on the correct network before approving. Withdrawal approval records completion only; send the crypto separately first.</p>
    {message && <p role="status" className="text-sm text-green-300">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {loading ? <p role="status" className="text-sm text-text-muted">Loading pending transactions…</p> : !error && !rows.length ? <p className="py-8 text-center text-sm text-text-muted">No pending crypto transactions.</p> : !error && <div className="space-y-3">{rows.map(row => <article key={row.id} className="rounded-xl border border-border-subtle bg-surface-primary p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-white">{row.username} <span className="text-xs text-text-muted">#{row.userId}</span></p><p className="mt-1 text-xs text-text-muted">Transaction #{row.id} · {row.type === "crypto_deposit" ? "Deposit" : "Withdrawal"} · {row.coin}</p><p className="mt-1 text-xs text-text-muted">{Number.isNaN(Date.parse(row.createdAt)) ? row.createdAt : new Date(row.createdAt).toLocaleString()}</p></div><strong className="text-lg text-white">{money(row.amount)}</strong></div>
      <p className="mt-2 text-xs text-text-muted">{row.bonusCode&&<>Requested {row.bonusCode} bonus: {money(Number(row.bonusAmount))} · Required wagering: {money(Number(row.wagerAmount))}. First-deposit eligibility is rechecked at approval.</>}</p><p className="mt-2 text-xs text-text-muted">Network: {withdrawalCoin(row.coin)?.network || "Verify network before processing"}</p>
      <p className="mt-3 break-all text-xs text-text-muted">{row.type === "crypto_withdraw" ? "Destination address" : "Transaction hash"}: {row.txHash || "Not provided by the server"}</p>
      <p className="mt-2 text-xs text-amber-200">{row.type==='crypto_withdraw'&&Number(row.wageringRemaining)>0?`Do not send this withdrawal: ${money(Number(row.wageringRemaining))} wagering remains.`:null}</p><div className="mt-4 flex gap-2"><Button size="sm" isDisabled={busy||(row.type==='crypto_withdraw'&&Number(row.wageringRemaining)>0)} onPress={() => { setReview({ transaction: row, reject: false }); setHash(""); }} className="bg-button-primary text-white">Review approval</Button><Button size="sm" isDisabled={busy} onPress={() => { setReview({ transaction: row, reject: true }); setHash(""); }} className="bg-highlight text-red-300">Reject</Button></div>
    </article>)}</div>}
    {review && <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-4 rounded-xl border border-purple-500 bg-highlight p-4">
      <h3 className="font-semibold text-white">{review.reject ? "Reject" : "Approve"} transaction #{review.transaction.id}</h3>
      <p className="text-sm text-white">{review.transaction.username} · {money(review.transaction.amount)} · {review.transaction.coin} · {withdrawalCoin(review.transaction.coin)?.network}</p>
      <p className="text-sm text-text-muted">{review.reject ? review.transaction.type === "crypto_withdraw" ? "The existing backend will refund the reserved withdrawal amount." : "The deposit will be rejected without crediting the player." : review.transaction.type === "crypto_deposit" ? "Confirm that you received this deposit. The backend credits the deposit once and awards the requested bonus only if this is the player’s first approved deposit." : "Confirm that you have already sent this withdrawal. This button does not transfer crypto."}</p>
      {!review.reject && review.transaction.type === "crypto_withdraw" && <label className="block text-xs text-text-muted">Outgoing transaction hash (optional)<input aria-label="Outgoing transaction hash" value={hash} onChange={e => setHash(e.target.value)} maxLength={255} disabled={busy} className="mt-2 w-full rounded-lg border border-border-subtle bg-surface-primary px-3 py-2 text-white" /></label>}
      <div className="flex flex-wrap gap-2"><Button type="submit" isDisabled={busy} className="bg-button-primary text-white">{busy ? "Processing…" : review.reject ? "Confirm rejection" : "Confirm approval"}</Button><Button type="button" isDisabled={busy} onPress={() => setReview(null)} className="bg-surface-primary text-white">Cancel</Button></div>
    </form>}
  </section>;
}
