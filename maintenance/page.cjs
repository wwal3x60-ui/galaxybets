'use strict';
const headers={
 'Cache-Control':'no-store, no-cache, must-revalidate, private, max-age=0',
 'CDN-Cache-Control':'no-store',
 'Vercel-CDN-Cache-Control':'no-store',
 'Retry-After':'300',
 'X-Robots-Tag':'noindex, nofollow, noarchive',
 'X-Content-Type-Options':'nosniff',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
 'X-GalaxyBets-Maintenance':'on',
};
const message={error:'SITE_MAINTENANCE',message:'GalaxyBets is under maintenance. Please check back soon.'};
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#0b0912"><title>Under Maintenance | GalaxyBets</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#0b0912;color:#f5f2fc;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}body{min-height:100svh;display:grid;place-items:center;padding:32px 20px;background:radial-gradient(ellipse at 50% 20%,#25123a55,transparent 65%),#0b0912}.card{width:min(100%,620px);text-align:center;padding:48px 36px 36px;background:#100d19;border:1px solid #31233f;border-radius:24px;box-shadow:0 24px 100px #0005}.brand{font-size:25px;font-weight:850;letter-spacing:-1.3px;line-height:1;margin-bottom:40px}.brand span{color:#a36bff}.icon{width:80px;height:80px;margin:0 auto 26px;display:grid;place-items:center;color:#bc91ff;background:#221631;border:1px solid #49305f;border-radius:23px}.icon svg{width:36px;height:36px}.status{display:inline-flex;align-items:center;gap:8px;font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#c5addc}.status:before{content:"";width:6px;height:6px;background:#ac76ef;border-radius:50%}h1{font-size:clamp(29px,6vw,40px);letter-spacing:-.055em;line-height:1.12;margin:18px 0}p{max-width:390px;margin:0 auto;color:#a79cb8;font-size:14px;line-height:1.8}.divider{height:1px;background:#2a2036;margin:32px 0 22px}.note{font-size:11px;color:#756982}.footer{margin-top:28px;font-size:11px;color:#5d526b}@media(max-width:440px){body{padding:20px 14px}.card{padding:34px 22px 27px;border-radius:18px}.brand{font-size:23px;margin-bottom:32px}.icon{width:68px;height:68px;border-radius:20px}p{font-size:13px}.footer{margin-top:22px}}
</style></head><body><main><section class="card" aria-labelledby="maintenance-title" data-galaxybets-maintenance="on"><div class="brand">Galaxy<span>Bets</span></div><div class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.8 6.3a5 5 0 0 1-6.2 6.2l-5 5a2 2 0 0 0 2.9 2.9l5-5a5 5 0 0 1 6.2-6.2l-3.4 3.4-2.8-2.8 3.3-3.5Z"/><path d="m4 3 3 3m12 11 2 2M19 3v3m-1.5-1.5h3"/></svg></div><div class="status">Maintenance in progress</div><h1 id="maintenance-title">We&rsquo;ll be back soon.</h1><p>GalaxyBets is temporarily unavailable while we work on updates. Please check back soon.</p><div class="divider"></div><p class="note">All site features are currently paused.</p></section><div class="footer" style="text-align:center">GalaxyBets &middot; Under maintenance</div></main></body></html>`;
module.exports={html,headers,message};
