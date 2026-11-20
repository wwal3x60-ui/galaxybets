export const withdrawalCoins = [
  { id: "usdt", name: "Tether", symbol: "USDT", network: "Tron (TRC20)", icon: "usdt", color: "#26A17B" },
  { id: "btc", name: "Bitcoin", symbol: "BTC", network: "Bitcoin", icon: "btc", color: "#F7931A" },
  { id: "usdc", name: "USD Coin", symbol: "USDC", network: "Ethereum (ERC20)", icon: "usdc", color: "#3E73C4" },
  { id: "eth", name: "Ethereum", symbol: "ETH", network: "Ethereum", icon: "eth", color: "#627EEA" },
  { id: "sol", name: "Solana", symbol: "SOL", network: "Solana", icon: "solana", color: "#9945FF" },
  { id: "trx", name: "Tron", symbol: "TRX", network: "Tron", icon: "trx", color: "#EF0027" },
  { id: "ltc", name: "Litecoin", symbol: "LTC", network: "Litecoin", icon: "ltc", color: "#BFBBBB" },
  { id: "doge", name: "Dogecoin", symbol: "DOGE", network: "Dogecoin", icon: "", color: "#C2A633" },
  { id: "bnb", name: "BNB", symbol: "BNB", network: "BNB Smart Chain (BEP20)", icon: "", color: "#F3BA2F" },
];
export function withdrawalCoin(token: string) {
  return withdrawalCoins.find(c => c.id === String(token ?? "").trim().toLowerCase());
}
// Browser format check; the backend checks supported chain addresses again.
export function validWithdrawalAddress(token: string, value: string): boolean {
  const coin = withdrawalCoin(token), address = String(value ?? "").trim();
  if (!coin) return false;
  switch (coin.symbol) {
    case "USDT": case "TRX": return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    case "ETH": case "USDC": case "BNB": return /^0x[a-fA-F0-9]{40}$/.test(address);
    case "SOL": return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    case "BTC": return /^(bc1[0-9a-z]{25,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/i.test(address);
    case "LTC": return /^(ltc1[0-9a-z]{25,87}|[LM3][1-9A-HJ-NP-Za-km-z]{25,34})$/i.test(address);
    case "DOGE": return /^D[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
    default: return false;
  }
}
