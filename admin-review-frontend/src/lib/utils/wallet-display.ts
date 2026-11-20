const dollars = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
export function formatWalletBalance(value: unknown): string {
  const text=typeof value==='number'?String(value):String(value??'0').trim().replace(/^USD\s*/i,'').replace(/\s*USD$/i,'').replace(/^\$/,'').replace(/,/g,'');
  const amount=text!==''?Number(text):0;
  return dollars.format(Number.isFinite(amount)?amount:0);
}
