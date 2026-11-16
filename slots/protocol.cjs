'use strict';
const crypto = require('node:crypto');
const error = (message, status=400) => Object.assign(new Error(message), { publicError: message, status });
const hmac = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');
function money(value) {
  const m = /^(-?)(0|[1-9]\d{0,11})(?:\.(\d{1,4}))?$/.exec(String(value));
  if (!m) throw error('INVALID_AMOUNT');
  return BigInt(m[2] + (m[3] || '').padEnd(4, '0')) * (m[1] ? -1n : 1n);
}
function decimal(n, digits=4) {
  const sign=n<0n?'-':''; const s=(n<0n?-n:n).toString().padStart(digits+1,'0');
  return sign+s.slice(0,-digits)+'.'+s.slice(-digits);
}
function text(value, name) {
  if (typeof value !== 'string' || !value.length || value.length>191 || ((name==='TransactionID'||name==='RefTransactionID')?/[\x00-\x1f]/:/[|\x00-\x1f]/).test(value)) throw error('INVALID_'+name.toUpperCase());
  return value;
}
function authenticate(body, kind, config, now=Math.floor(Date.now()/1000)) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw error('INVALID_REQUEST');
  if (body.AppID !== config.appId) throw error('INVALID_APPID',403);
  text(body.UserID,'UserID');
  if (!(kind==='get' && body.UserID==='codejackpot-wallet-test') && !/^[1-9]\d{0,19}$/.test(body.UserID)) throw error('INVALID_USERID');
  const ts=String(body.Ts);
  if (!/^\d{10}$/.test(ts) || Math.abs(now-Number(ts))>60) throw error('STALE_TIMESTAMP',403);
  let signed=[body.AppID,body.UserID,ts];
  let amount;
  if (kind==='transfer') {
    for (const name of ['TransactionID','RoundID','Reason','GameID']) text(body[name],name);
    if (!['bet','win','refund'].includes(body.Reason)) throw error('INVALID_REASON');
    amount=money(body.Amount);
    if (body.Reason==='bet' && amount>=0n || body.Reason!=='bet' && amount<0n) throw error('INVALID_AMOUNT_SIGN');
    signed=[body.AppID,body.UserID,body.TransactionID,body.RoundID,body.Reason,body.GameID,decimal(amount),ts];
  }
  const expected=hmac(config.secret,signed.join('|'));
  if (typeof body.Sign!=='string' || !/^[a-fA-F0-9]{64}$/.test(body.Sign) || !crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(body.Sign,'hex'))) throw error('INVALID_SIGNATURE',403);
  // These fields are not covered by the provider signature: bind them to our USD session.
  if (kind==='transfer') {
    if (body.Currency!==config.currency) throw error('CURRENCY_MISMATCH');
    if (body.RealAmount!=null && money(body.RealAmount)!==amount) throw error('WALLET_MULTIPLIER_UNSUPPORTED');
    if (body.IsEnd!==true && body.IsEnd!==false) throw error('INVALID_ISEND');
    if (body.FreeRound || body.GrantID) throw error('FREE_ROUNDS_NOT_ENABLED');
    if (body.Reason==='refund') text(body.RefTransactionID,'RefTransactionID');
  }
  return { amount };
}
function fingerprint(body) {
  return crypto.createHash('sha256').update(JSON.stringify([body.AppID,body.UserID,body.TransactionID,body.RoundID,body.Reason,body.GameID,decimal(money(body.Amount)),body.Currency,body.RealAmount==null?null:decimal(money(body.RealAmount)),body.IsEnd,body.RefTransactionID||null,body.FreeRound||false,body.GrantID||null])).digest('hex');
}
function decision({body, amount, balance, previous, round, reference, maxBet}) {
  const hash=fingerprint(body);
  if (previous) {
    if (previous.payloadHash!==hash) throw error('TRANSACTION_ID_REUSED',409);
    return { replay:typeof previous.response==='string'?JSON.parse(previous.response):previous.response };
  }
  if (round && (String(round.userId)!==body.UserID || round.gameId!==body.GameID || round.currency!==body.Currency)) throw error('ROUND_MISMATCH');
  if (round?.closed) throw error('ROUND_ALREADY_CLOSED');
  if (body.Reason==='bet') {
    if (-amount>maxBet) throw error('TEST_STAKE_LIMIT');
    if (balance+amount<0n) throw error('INSUFFICIENT_BALANCE');
  } else if (!round) throw error('UNKNOWN_ROUND');
  if (body.Reason==='refund') {
    const refResponse=reference && (typeof reference.response==='string'?JSON.parse(reference.response):reference.response);
    if (!reference || refResponse?.code!==0 || reference.reason!=='bet' || reference.roundId!==body.RoundID || String(reference.userId)!==body.UserID || reference.gameId!==body.GameID || reference.refunded || money(reference.amount)!==-amount) throw error('INVALID_REFUND');
  }
  return { hash, after:balance+amount };
}
function catalogue(raw) {
  const data=raw?.data ?? raw;
  const list=Array.isArray(data)?data:data?.games ?? data?.Games;
  if (!Array.isArray(list)) throw error('CATALOGUE_FORMAT_UNRECOGNISED',502);
  const result=[];
  for (const g of list) {
    const id=g.gameId ?? g.GameID;
    if (typeof id!=='string' || !id || id.length>191 || /[|\x00-\x1f]/.test(id)) continue;
    const provider=String(g.provider?.name ?? g.providerName ?? g.provider ?? 'Other');
    const type=String(g.type ?? g.category ?? '').toLowerCase();
    if (/live|table/.test(type)) continue;
    const image=g.image ?? g.imageUrl ?? g.thumbnail ?? '';
    result.push({id,name:String(g.name ?? g.gameName ?? id),provider,image:typeof image==='string'&&/^https:\/\//.test(image)?image:'',type});
  }
  if (list.length && !result.length) throw error('CATALOGUE_FIELDS_NEED_REVIEW',502);
  return result;
}
module.exports={money,decimal,hmac,error,text,authenticate,fingerprint,decision,catalogue};
