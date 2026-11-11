const express = require('express');
const router = express.Router();

const { sql, doTransaction } = require('../../database');
const { isAuthed, apiLimiter } = require('../auth/functions');
const { depositCryptoLimiter } = require('./limiters');

const bonus = require('../../utils/deposit-bonus');

router.get('/bonus-config', apiLimiter, async (req,res) => {
    try { await bonus.ensureReady(sql); return res.json({version:bonus.VERSION,codeMode:'streamer-affiliate',tiers:bonus.tiers,maxBonus:'500.00',multiplier:'1.8'}); }
    catch(error){return res.status(503).json({error:'BONUS_NOT_READY'});}
});

router.get('/bonus-offer', isAuthed, apiLimiter, async (req,res) => {
    try { return res.json(await bonus.offer(sql,req.userId,req.query.amount,req.query.code)); }
    catch(error){if(error.publicError)return res.status(error.status||400).json({error:error.publicError});console.error('Bonus offer:',error.code||error.message);return res.status(500).json({error:'INTERNAL_SERVER_ERROR'});}
});

const allowedCoins = ['SOL', 'USDT', 'TRX', 'TRX (Tron)', 'LTC', 'DOGE', 'ETH', 'BNB', 'USDC'];

router.post('/crypto', depositCryptoLimiter, isAuthed, apiLimiter, async (req, res) => {
    const { amount, coin, txHash, bonusCode, bonusTermsAccepted } = req.body || {};
    const normalizedCoin = coin === 'TRX (Tron)' ? 'TRX' : coin;

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) {
        return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }
    if (amount < 5) return res.status(400).json({error:'MIN_DEPOSIT_FIVE_DOLLARS'});
    if (!allowedCoins.includes(coin)) return res.status(400).json({ error: 'INVALID_COIN' });
    if (typeof txHash !== 'string' || !txHash.trim() || txHash.length > 255) {
        return res.status(400).json({ error: 'INVALID_TX_HASH' });
    }

    try {
        const code=bonus.normalizeCode(bonusCode);
        if(code&&bonusTermsAccepted!==true)return res.status(400).json({error:'BONUS_TERMS_REQUIRED'});
        const result=await doTransaction(async(connection,commit)=>{
            const [[user]]=await connection.query('SELECT id,role,banned,accountLock FROM users WHERE id=? FOR UPDATE',[req.userId]);
            if(!user||user.banned||user.accountLock||String(user.role).trim().toUpperCase()==='BOT')throw Object.assign(new Error('DEPOSIT_RESTRICTED'),{publicError:'DEPOSIT_RESTRICTED',status:403});
            let quote=null;
            if(code){await bonus.ensureReady(connection);const eligible=await bonus.readEligibility(connection,req.userId);if(!eligible.eligible)throw Object.assign(new Error(eligible.reason),{publicError:eligible.reason,status:409});quote=bonus.calculate(String(amount),code);}
            const [[existingTransaction]]=await connection.query('SELECT id FROM transactions WHERE txHash=? LIMIT 1',[txHash.trim()]);
            if(existingTransaction)throw Object.assign(new Error('TX_HASH_ALREADY_CLAIMED'),{publicError:'TX_HASH_ALREADY_CLAIMED',status:409});
            const [saved]=await connection.query('INSERT INTO transactions (userId,amount,type,method,coin,txHash,status) VALUES (?,?,?,?,?,?,?)',[req.userId,amount,'crypto_deposit','crypto_manual',normalizedCoin,txHash.trim(),'pending']);
            if(quote)await bonus.saveRequest(connection,req.userId,saved.insertId,String(amount),code);
            await commit();return {transactionId:saved.insertId,bonus:quote};
        });
        return res.json({success:true,...result});
    } catch (error) {
        if(error.publicError)return res.status(error.status||400).json({error:error.publicError});
        if(error.code==='ER_DUP_ENTRY')return res.status(409).json({error:'TX_HASH_ALREADY_CLAIMED'});
        console.error("DEPOSIT ERROR:", error);
        return res.status(500).json({ error: 'DEPOSIT_FAILED' });
    }
});

// List of the logged-in user's crypto deposits (for the Deposits history page)
router.get('/', isAuthed, async (req, res) => {
    try {
        const [rows] = await sql.query(
            `SELECT t.id,t.amount,t.coin,t.txHash,t.status,t.createdAt,b.code AS bonusCode,b.status AS bonusStatus,b.reason AS bonusReason,b.bonusAmount,b.wagerAmount
             FROM transactions t LEFT JOIN depositBonusRequests b ON b.transactionId=t.id
             WHERE t.userId=? AND t.type='crypto_deposit' ORDER BY t.id DESC LIMIT 200`,
            [req.userId]
        );
        return res.json(rows);
    } catch (error) {
        console.error('DEPOSIT LIST ERROR:', error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
});

module.exports = router;
