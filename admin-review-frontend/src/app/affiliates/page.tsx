'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  affiliateErrorMessage, getAffiliateStats, getAffiliateUsers,
  redeemAffiliateCode, setAffiliateCode, claimAllReferralEarnings,
  type AffiliateStats, type AffiliateUsersPage,
} from '@/lib/api/affiliates';
import { useAuthStore } from '@/store/auth.store';
import { useModalStore } from '@/store/modal.store';

const money = (value: string | number) => Number(value || 0).toLocaleString('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const detail = (value: string | number) => Number(value || 0).toFixed(8);

export default function AffiliatesPage() {
  const token = useAuthStore(state => state.token);
  const hydrated = useAuthStore(state => state.hasHydrated);
  const open = useModalStore(state => state.open);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [users, setUsers] = useState<AffiliateUsersPage | null>(null);
  const [page, setPage] = useState(1);
  const [code, setCode] = useState('');
  const [referral, setReferral] = useState('');
  const [origin, setOrigin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestId = useRef(0);
  const claimRequest = useRef<string | null>(null);
  const claiming = useRef(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setReferral(new URLSearchParams(window.location.search).get('ref') || '');
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const id = ++requestId.current;
    try {
      const [nextStats, nextUsers] = await Promise.all([getAffiliateStats(), getAffiliateUsers(page)]);
      if (id !== requestId.current) return;
      setStats(nextStats);
      setUsers(nextUsers);
      setError('');
    } catch (cause) {
      if (id === requestId.current) setError(affiliateErrorMessage(cause));
    }
  }, [token, page]);

  useEffect(() => {
    setStats(null);
    setUsers(null);
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 10000);
    return () => { requestId.current++; window.clearInterval(timer); };
  }, [refresh]);

  async function submit(event: FormEvent, action: 'code' | 'redeem') {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'code') {
        await setAffiliateCode(code.trim());
        setCode('');
        setNotice('Your referral code has been updated.');
      } else {
        await redeemAffiliateCode(referral.trim());
        setReferral('');
        setNotice('Referral code linked successfully.');
      }
      await refresh();
    } catch (cause) {
      setError(affiliateErrorMessage(cause));
    } finally { setBusy(false); }
  }

  async function claim() {
    if (claiming.current || busy || !stats?.canClaim) return;
    claiming.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      claimRequest.current ??= crypto.randomUUID();
      const result = await claimAllReferralEarnings(claimRequest.current);
      claimRequest.current = null;
      setNotice(`${money(result.claimedAmount)} transferred from affiliate earnings to your site balance. Refresh your balance if needed.`);
      await refresh();
    } catch (cause) {
      setError(affiliateErrorMessage(cause));
    } finally { claiming.current = false; setBusy(false); }
  }

  const link = stats?.referralCode && origin
    ? `${origin}/affiliates?ref=${encodeURIComponent(stats.referralCode)}` : '';

  return (
    <main className="affiliate-page">
      <header className="hero">
        <span className="eyebrow">REFERRALS</span>
        <h1>Your community. Your rewards.</h1>
        <p>Earn 3% of the recorded house edge from eligible referred players’ completed games.</p>
        <span className="automatic">Manual withdrawal · $5 minimum · 8 depositing referrals</span>
      </header>

      {!hydrated ? <p role="status">Loading your account…</p> : !token ? (
        <section className="panel signin">
          <h2>Sign in to your referral dashboard</h2>
          <p>Create your code, view referred players, and withdraw your affiliate earnings.</p>
          <button onClick={() => open('login')}>Sign in</button>
        </section>
      ) : <>
        {error && <p className="message error" role="alert">{error}</p>}
        {notice && <p className="message success" role="status">{notice}</p>}
        {!stats ? <section className="panel" role="status">
          <p>Loading referral data…</p><button onClick={() => void refresh()}>Retry</button>
        </section> : <>
          <section className="stats" aria-label="Referral statistics">
            <article className="panel"><span>Referred players</span><strong>{stats.referralsCount}</strong></article>
            <article className="panel"><span>Earned since rollout</span><strong>{money(stats.totalEarned)}</strong><small>Exact: {detail(stats.totalEarned)}</small></article>
            <article className="panel"><span>Credited to balance</span><strong>{money(stats.claimedAmount)}</strong><small>Includes previous automatic credits and manual withdrawals</small></article>
            <article className="panel"><span>Fractional carry</span><strong className="fraction">{detail(stats.fractionalRemainder)}</strong><small>Carried into your next whole cent of earnings</small></article>
          </section>

          <section className="panel withdrawal" aria-label="Affiliate withdrawal">
            <div>
              <h2>Withdraw affiliate earnings</h2>
              <p>Available: <b>{money(stats.unclaimedAmount)}</b></p>
              <p>Depositing referrals: <b>{stats.qualifiedDepositors} / {stats.minDepositors} required</b></p>
              <p>Each different referred player counts once after a positive deposit made under your code is approved. This is a lifetime requirement; it does not reset after withdrawal.</p>
              <p>Minimum withdrawal: <b>{money(stats.minClaim)}</b>. Withdrawals transfer all available whole cents to your site balance. Fractional carry stays in your affiliate wallet.</p>
            </div>
            <button disabled={busy || !stats.canClaim} onClick={() => void claim()}>
              {claiming.current ? 'Withdrawing…' : `Withdraw ${money(stats.unclaimedAmount)}`}
            </button>
            {!stats.canClaim && <small>Unlock with {stats.minDepositors} depositing referrals and at least {money(stats.minClaim)} available earnings.</small>}
          </section>

          <section className="panel share">
            <div><h2>Your referral link</h2><p>Code: <b>{stats.referralCode}</b></p></div>
            <div className="link-row"><input aria-label="Your referral link" value={link} readOnly onFocus={event => event.currentTarget.select()} />
              <button disabled={!link || busy} onClick={async () => {
                try { await navigator.clipboard.writeText(link); setNotice('Referral link copied.'); }
                catch { setError('Select and copy the referral link above.'); }
              }}>Copy link</button>
            </div>
          </section>

          <section className="forms">
            <form className="panel" onSubmit={event => void submit(event, 'code')}>
              <h2>Customize your code</h2>
              <label htmlFor="own-code">3–15 letters or numbers</label>
              <div className="link-row"><input id="own-code" value={code} onChange={event => setCode(event.target.value)} pattern="[A-Za-z0-9]{3,15}" minLength={3} maxLength={15} required autoComplete="off" />
                <button disabled={busy}>Save code</button></div>
            </form>
            <form className="panel" onSubmit={event => void submit(event, 'redeem')}>
              <h2>Use a referral code</h2>
              {stats.referredByCode ? <p>Linked to code <b>{stats.referredByCode}</b>.</p> : <>
                <label htmlFor="referral-code">Available immediately after signup. Linking a code does not grant a cash reward.</label>
                <div className="link-row"><input id="referral-code" value={referral} onChange={event => setReferral(event.target.value)} pattern="[A-Za-z0-9]{2,20}" minLength={2} maxLength={20} required autoComplete="off" />
                  <button disabled={busy}>Use code</button></div>
              </>}
            </form>
          </section>

          {Number(stats.legacyUnclaimedAmount) !== 0 && <aside className="panel legacy">
            <h2>Pre-rollout pending earnings: {money(stats.legacyUnclaimedAmount)}</h2>
            <p>This older amount is tracked separately and has not been automatically paid. Contact support about settlement.</p>
          </aside>}

          <section className="panel table-panel">
            <div className="table-heading"><h2>Referred players</h2><button className="secondary" disabled={busy} onClick={() => void refresh()}>Refresh</button></div>
            <div className="table-scroll"><table>
              <thead><tr><th>Player</th><th>Total wagered</th><th>Earned since rollout</th><th>Previously auto-credited</th></tr></thead>
              <tbody>{users?.data.map(user => <tr key={user.id}>
                <td>{user.username}</td><td>{money(user.totalWagered)}</td>
                <td title={detail(user.totalEarnings)}>{money(user.totalEarnings)}</td><td>{money(user.totalCredited)}</td>
              </tr>)}</tbody>
            </table></div>
            {!users?.data.length && <p className="empty">No referred players yet. Share your code to get started.</p>}
            {!!users?.pages && <nav className="pagination" aria-label="Referral pages">
              <button className="secondary" disabled={page <= 1 || busy} onClick={() => setPage(value => value - 1)}>Previous</button>
              <span>Page {page} of {users.pages}</span>
              <button className="secondary" disabled={page >= users.pages || busy} onClick={() => setPage(value => value + 1)}>Next</button>
            </nav>}
          </section>
          <p className="footnote">Commissions use recorded house edge, rather than wager size. Zero-edge games earn no commission. Bot and self-referrals are excluded. Statistics refresh every 10 seconds.</p>
        </>}
      </>}

      <style jsx>{`
        .affiliate-page{max-width:1180px;margin:0 auto;padding:36px 24px 64px;color:#f5f4fa}
        .hero{padding:18px 0 28px}.eyebrow{font-size:12px;letter-spacing:.18em;color:#d2d2d7;font-weight:700}
        h1{font-size:clamp(28px,4vw,44px);line-height:1.15;margin:12px 0 16px;font-weight:750;letter-spacing:-.03em}
        h2{font-size:17px;font-weight:650;margin:0 0 12px}p{color:#aaa8bb;line-height:1.65;margin:8px 0}
        .automatic{display:inline-block;margin-top:14px;padding:7px 12px;border-radius:30px;background:#18382d;color:#91e7b4;font-size:12px}
        .panel{background:#222327;border:1px solid #3c3d41;border-radius:16px;padding:24px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}
        .stats span,.stats small{display:block;color:#aaa8bb;font-size:12px}.stats strong{display:block;font-size:30px;letter-spacing:-.03em;margin:12px 0 8px}.stats .fraction{font-size:23px}
        .withdrawal{margin-bottom:18px}.withdrawal button{margin:10px 0}.withdrawal small{display:block;color:#aaa8bb}.withdrawal p{font-size:13px}.share{margin-bottom:18px}.link-row{display:flex;gap:10px;align-items:center}.link-row input{flex:1;min-width:0}
        input{color:#fff;background:#16171b;border:1px solid #4e4f53;border-radius:9px;padding:12px;font:inherit;width:100%}input:focus{outline:2px solid #eb808b;outline-offset:2px}
        button{background:#eb808b;color:#2a2b2f;border:0;border-radius:9px;padding:12px 18px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}button:disabled{opacity:.5;cursor:default}
        button:focus-visible{outline:2px solid #fff;outline-offset:3px}.secondary{background:#3d3e42;color:#eee8ff}
        .forms{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}label{display:block;font-size:12px;color:#aaa8bb;margin-bottom:12px}
        .legacy{margin-bottom:18px;border-color:#75623c}.legacy p{font-size:13px}.message{padding:14px 18px;border-radius:10px;margin-bottom:18px}.error{background:#44242e;color:#ffd0d8}.success{background:#19392e;color:#b2f2cd}
        .table-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.table-heading h2{margin:0}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px;text-align:left;white-space:nowrap}
        th{font-weight:500;color:#aaa8bb;font-size:12px;padding:10px 16px}td{padding:16px;border-top:1px solid #3c3d41}.empty{padding:28px;text-align:center;font-size:13px}
        .pagination{display:flex;align-items:center;justify-content:flex-end;gap:14px;margin-top:20px;font-size:12px}.footnote{font-size:12px;margin:20px 0}.signin{text-align:center;padding:44px}.signin button{margin-top:12px}
        @media(max-width:850px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.forms{grid-template-columns:1fr}}
        @media(max-width:480px){.affiliate-page{padding:20px 14px 40px}.panel{padding:18px}.stats{gap:10px}.stats strong{font-size:25px}.stats .fraction{font-size:19px}.link-row{flex-wrap:wrap}.link-row input{flex-basis:100%}.link-row button{width:100%}.pagination{justify-content:center;gap:8px}}
      `}</style>
    </main>
  );
}
