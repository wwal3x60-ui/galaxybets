import {Title} from "@solidjs/meta";
import {createSignal, Show} from "solid-js";
import {authedAPI} from "../util/api";

const walletAddresses = {
  SOL: "52bQWDcjB8uDB9zTCvm7NvykXMXjDBgyr7jE8jLrbZyz",
  USDT: "TVThNL6cSDezzt7Up3JmT2NPzJELmuv7dm",
  TRX: "TVThNL6cSDezzt7Up3JmT2NPzJELmuv7dm",
  LTC: "LVdep1YemWVsPTYiKvK73LFknJ64ZKRacy",
  DOGE: "DH2xt6hvDBAfmhFFT1xmoWgxpja1JjPj7F",
  ETH: "0xd1e973e0a5fb839a1c6d7beb322109eafec0d3bb",
  BNB: "0xd1e973e0a5fb839a1c6d7beb322109eafec0d3bb",
  USDC: "0xd1e973e0a5fb839a1c6d7beb322109eafec0d3bb"
};

function Deposits() {
  const [coin, setCoin] = createSignal("SOL");
  const [txHash, setTxHash] = createSignal("");
  const [amount, setAmount] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [message, setMessage] = createSignal(null);
  const [copyStatus, setCopyStatus] = createSignal("");

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(walletAddresses[coin()]);
      setCopyStatus("Address copied!");
    } catch (error) {
      console.error("Failed to copy crypto deposit address:", error);
      setCopyStatus("Unable to copy address. Please copy it manually.");
    }
  }

  async function submitDeposit(event) {
    event.preventDefault();
    if (submitting()) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await authedAPI("/api/deposits/crypto", "POST", JSON.stringify({
        coin: coin(),
        txHash: txHash().trim(),
        amount: Number(amount())
      }));

      if (result?.success) {
        setMessage({type: "success", text: "Deposit submitted! Please wait for admin approval."});
        setTxHash("");
        setAmount("");
      } else {
        setMessage({
          type: "error",
          text: result?.error || "Failed to submit."
        });
      }
    } catch (error) {
      console.error("Failed to submit crypto deposit:", error);
      setMessage({type: "error", text: error?.message || "Failed to submit."});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Title>GalaxyBets | Deposit</Title>
      <main class='payments-page'>
        <section class='payments-panel'>
          <header class='panel-header'>
            <p class='eyebrow'>ADD FUNDS</p>
            <h1>CRYPTO DEPOSIT</h1>
            <p class='subtitle'>Send your crypto, then submit its transaction details for review.</p>
          </header>

          <form onSubmit={submitDeposit}>
            <label class='field'>
              <span>COIN</span>
              <select value={coin()} onChange={event => {
                setCoin(event.currentTarget.value);
                setMessage(null);
                setCopyStatus("");
              }}>
                <option value='SOL'>SOL (Solana)</option>
                <option value='USDT'>USDT (TRC20)</option>
                <option value='TRX'>TRX (Tron)</option>
                <option value='LTC'>LTC (Litecoin)</option>
                <option value='DOGE'>DOGE (Dogecoin)</option>
                <option value='ETH'>ETH (ERC20)</option>
                <option value='BNB'>BNB (BSC)</option>
                <option value='USDC'>USDC (ERC20)</option>
              </select>
            </label>

            <div class='field'>
              <span>DEPOSIT ADDRESS</span>
              <div class='address-row'>
                <div class='address-box'>
                <code>{walletAddresses[coin()]}</code>
                </div>
                <button class='copy-button' type='button' onClick={copyAddress}>
                COPY ADDRESS
                </button>
              </div>
              <small class='warning'>
                Only send the selected coin to this address. Sending any other coin will result in permanent loss.
              </small>
              <Show when={copyStatus()}>
                <small class='copy-status' role='status' aria-live='polite'>{copyStatus()}</small>
              </Show>
            </div>

            <label class='field'>
              <span>TRANSACTION HASH (TXID)</span>
              <input
                type='text'
                value={txHash()}
                onInput={event => setTxHash(event.currentTarget.value)}
                placeholder='Paste your transaction hash'
                maxlength='255'
                autocomplete='off'
                required
              />
            </label>

            <label class='field'>
              <span>AMOUNT DEPOSITED (USD)</span>
              <div class='amount-input'>
                <span>$</span>
                <input
                  type='number'
                  value={amount()}
                  onInput={event => setAmount(event.currentTarget.value)}
                  placeholder='0.00'
                  min='0.01'
                  step='0.01'
                  required
                />
              </div>
            </label>

            <Show when={message()}>
              <p class={`form-message ${message().type}`} role='status' aria-live='polite'>
                {message().text}
              </p>
            </Show>

            <button class='submit-button bevel-purple' type='submit' disabled={submitting()}>
              {submitting() ? "SUBMITTING..." : "SUBMIT DEPOSIT"}
            </button>
          </form>
        </section>
      </main>

      <style jsx>{`
        .payments-page {
          width: 100%;
          max-width: 1175px;
          min-height: calc(100vh - 130px);
          box-sizing: border-box;
          padding: 38px 20px;
          margin: 0 auto;
        }

        .payments-panel {
          width: 100%;
          max-width: 620px;
          margin: 0 auto;
          padding: 34px;
          border: 1px solid #9d4edd;
          border-radius: 12px;
          background: #1a0b2e;
          box-shadow: 0 16px 50px rgba(0, 0, 0, 0.28), 0 0 30px rgba(157, 78, 221, 0.08);
        }

        .panel-header {
          margin-bottom: 28px;
          text-align: center;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: var(--highlight-purple, #c77dff);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        h1 {
          margin: 0;
          color: #fff;
          font-family: Geogrotesque Wide, sans-serif;
          font-size: 24px;
          font-weight: 800;
        }

        .subtitle {
          margin: 8px 0 0;
          color: var(--text-muted, #b3a1c6);
          font-size: 13px;
          font-weight: 500;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #d7c6ea;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        select,
        input,
        .address-box {
          width: 100%;
          min-height: 48px;
          border: 1px solid #9d4edd;
          border-radius: 6px;
          outline: none;
          background: rgba(11, 4, 20, 0.85);
          color: #fff;
          font: 500 14px "Geogrotesque Wide", sans-serif;
        }

        select,
        input {
          padding: 0 14px;
        }

        select:focus,
        input:focus {
          border-color: var(--highlight-purple, #c77dff);
          box-shadow: 0 0 0 3px rgba(157, 78, 221, 0.16);
        }

        select option {
          background: #1a0b2e;
        }

        .address-row {
          display: flex;
          gap: 10px;
        }

        .address-box {
          display: flex;
          align-items: center;
          min-width: 0;
          overflow-wrap: anywhere;
          padding: 12px 14px;
          color: var(--highlight-purple, #c77dff);
        }

        .address-box code {
          font: 500 13px "Geogrotesque Wide", sans-serif;
        }

        .copy-button {
          flex: 0 0 auto;
          min-height: 48px;
          padding: 0 14px;
          border: 1px solid #9d4edd;
          border-radius: 6px;
          background: rgba(157, 78, 221, 0.16);
          color: #fff;
          cursor: pointer;
          font: 700 11px "Geogrotesque Wide", sans-serif;
          letter-spacing: 0.4px;
        }

        .copy-button:hover {
          background: rgba(157, 78, 221, 0.3);
        }

        input::placeholder {
          color: #78688b;
        }

        small {
          color: #9584a8;
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0;
        }

        small.warning {
          color: #ffce75;
          line-height: 1.5;
        }

        small.copy-status {
          color: var(--highlight-purple, #c77dff);
        }

        .amount-input {
          position: relative;
        }

        .amount-input > span {
          position: absolute;
          top: 50%;
          left: 14px;
          z-index: 1;
          color: var(--highlight-purple, #c77dff);
          transform: translateY(-50%);
        }

        .amount-input input {
          padding-left: 30px;
        }

        .form-message {
          margin: -4px 0 0;
          font-size: 13px;
          font-weight: 600;
        }

        .form-message.success {
          color: #59e878;
        }

        .form-message.error {
          color: #ff7777;
        }

        .submit-button {
          min-height: 48px;
          font-size: 13px;
          letter-spacing: 0.6px;
          transition: filter 0.2s ease, opacity 0.2s ease;
        }

        .submit-button:not(:disabled):hover {
          filter: brightness(1.15);
        }

        .submit-button:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        @media (max-width: 560px) {
          .payments-page {
            padding: 22px 14px;
          }

          .payments-panel {
            padding: 24px 18px;
          }

          .address-row {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}

export default Deposits;
