'use strict';
const { randomInt } = require('node:crypto');
const GAME = 'coinflip_house';
const MULTIPLIER = 1.9; // 50/50 outcome, 5% house edge; total return includes the stake.
function cents(value) {
    if (!['string', 'number'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw Object.assign(Error('INVALID_AMOUNT'), { status: 400 });
    const [whole, fraction=''] = String(value).split('.');
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
function decimal(value) { const text=value.toString().padStart(3,'0'); return text.slice(0,-2)+'.'+text.slice(-2); }
function validate(input, maximum=10000) {
    if (!input || !['fire','ice'].includes(input.side)) throw Object.assign(Error('INVALID_SIDE'),{status:400});
    if (typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) throw Object.assign(Error('INVALID_REQUEST_ID'),{status:400});
    const amount=cents(input.amount);
    if(amount<20n || amount>cents(maximum)) throw Object.assign(Error('INVALID_AMOUNT'),{status:400});
    return {requestId:input.requestId.toLowerCase(),side:input.side,amount};
}
function payout(amount, won) { return won ? (amount*190n+50n)/100n : 0n; }
function winner(draw=randomInt) { return draw(0,2) === 0 ? 'fire' : 'ice'; }
function publicResult(row) { return {id:String(row.id),requestId:row.requestId,side:row.side,winner:row.winner,amount:decimal(cents(row.amount)),payout:decimal(cents(row.payout)),won:row.side===row.winner,multiplier:MULTIPLIER,createdAt:row.createdAt}; }
// Caller supplies one SQL transaction. User row is always locked before request lookup.
async function settle(connection,userId,input,{maxBet=10000,xpMultiplier=1,draw,credit=async()=>[],xpChanged=async()=>{}}={}) {
    const bet=validate(input,maxBet);
    const [[user]]=await connection.query('SELECT id, username, role, anon, xp, banned, accountLock, CAST(balance AS CHAR) AS balance FROM users WHERE id = ? FOR UPDATE',[userId]);
    if(!user)throw Object.assign(Error('UNKNOWN_USER'),{status:404});
    const [[prior]]=await connection.query('SELECT * FROM coinflipHouse WHERE userId = ? AND requestId = ? FOR UPDATE',[userId,bet.requestId]);
    if(prior) {
        if(prior.side!==bet.side || cents(prior.amount)!==bet.amount) throw Object.assign(Error('REQUEST_CONFLICT'),{status:409});
        return {result:publicResult(prior),replay:true};
    }
    if(Number(user.banned) || Number(user.accountLock) || user.role==='BOT')throw Object.assign(Error('ACCOUNT_LOCKED'),{status:403});
    if(cents(user.balance)<bet.amount)throw Object.assign(Error('INSUFFICIENT_BALANCE'),{status:400});
    const winningSide=winner(draw), paid=payout(bet.amount,winningSide===bet.side);
    const amount=decimal(bet.amount), winnings=decimal(paid), edge=decimal((bet.amount*5n+50n)/100n);
    const [saved]=await connection.query('INSERT INTO coinflipHouse (userId,requestId,side,winner,amount,payout) VALUES (?,?,?,?,?,?)',[userId,bet.requestId,bet.side,winningSide,amount,winnings]);
    const xp=Math.max(0,Math.floor(Number(amount)*Number(xpMultiplier||0)));
    await connection.query('UPDATE users SET balance = balance - ? + ?, xp = xp + ? WHERE id = ?',[amount,winnings,xp,userId]);
    await connection.query('INSERT INTO bets (userId,amount,winnings,edge,game,gameId,completed) VALUES (?,?,?,?,?,?,1)',[userId,amount,winnings,edge,GAME,saved.insertId]);
    if(xp)await xpChanged(userId,user.xp,Number(user.xp)+xp,connection);
    const credits=await credit(connection,GAME,[saved.insertId]);
    const [[row]]=await connection.query('SELECT * FROM coinflipHouse WHERE id = ?',[saved.insertId]);
    return {result:publicResult(row),replay:false,credits,user,amount:Number(amount),payout:Number(winnings),edge:Number(edge)};
}
module.exports={GAME,MULTIPLIER,cents,decimal,validate,payout,winner,publicResult,settle};
