'use strict';
const validator = require('multicoin-address-validator');
const coins = Object.freeze({SOL:'Solana',USDT:'Tron (TRC20)',BTC:'Bitcoin',TRX:'Tron',LTC:'Litecoin',DOGE:'Dogecoin',ETH:'Ethereum',BNB:'BNB Smart Chain (BEP20)',USDC:'Ethereum (ERC20)'});
function validAddress(coin, address) {
    if (!Object.hasOwn(coins, coin) || typeof address !== 'string') return false;
    try {
        const chain = ({USDT:'TRX',USDC:'ETH',BNB:'ETH'})[coin] || coin;
        if (chain === 'ETH' && !/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
        return validator.validate(address, chain, 'prod');
    } catch { return false; }
}
module.exports = {coins, validAddress};
