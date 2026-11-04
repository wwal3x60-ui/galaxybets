import {Title} from "@solidjs/meta";
import {createSignal, Show} from "solid-js";
import {useUser} from "../contexts/usercontextprovider";
import {authedAPI} from "../util/api";
import {formatUSD} from "../util/numbers";

function Withdraws() {
  const [user, {setBalance}] = useUser();
  const [coin, setCoin] = createSignal("SOL");
  const [amount, setAmount] = createSignal("");
  const [address, setAddress] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [message, setMessage] = createSignal(null);

  async function submitWithdrawal(event) {
    event.preventDefault();
    if (submitting()) return;

    const withdrawalAmount = Number(amount());
    const currentBalance = Number(user()?.balance || 0);

    if (!Number.isFinite(withdrawalAmount) || withdrawalAmount <= 0) {
      setMessage({type: "error", text: "Enter a withdrawal amount greater than $0."});
      return;
    }

    if (withdrawalAmount > currentBalance) {
      setMessage({type: "error", text: "The withdrawal amount cannot exceed your current balance."});
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await authedAPI("/api/withdrawals/crypto", "POST", JSON.stringify({
        amount: withdrawalAmount,
        coin: coin(),
        address: address().trim()
      }));

      if (result?.success) {
        setBalance(Math.round((currentBalance - withdrawalAmount) * 100) / 100);
        setAmount("");
        setAddress("");
        setMessage({type: "success", text: "Withdrawal submitted! Please wait for admin approval."});
      } else {
        const errors = {
          INVALID_AMOUNT: "Enter a valid withdrawal amount.",
          INVALID_COIN: "This cryptocurrency is not currently supported for withdrawals.",
          INVALID_ADDRESS: "Enter a valid destination wallet address.",
          INSUFFICIENT_BALANCE: "Your balance is too low for this withdrawal."
        };
        setMessage({
          type: "error",
          text: errors[result?.error] || "Unable to submit your withdrawal. Please try again."
        });
      }
    } catch (error) {
      console.error("Failed to submit crypto withdrawal:", error);
      setMessage({type: "error", text: "Unable to submit your withdrawal. Please try again."});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Title>GalaxyBets | Withdraw</Title>
      <main class='payments-page'>
        <section class='payments-panel'>
          <header class='panel-header'>
            <p class='eyebrow'>CASH OUT</p>
            <h1>CRYPTO WITHDRAWAL</h1>
            <p class='subtitle'>Withdraw your balance to a cryptocurrency wallet.</p>
          </header>

          <div class='balance-card' aria-live='polite'>
            <span>AVAILABLE BALANCE</span>
            <strong>{formatUSD(user()?.balance)}</strong>
          </div>

          <form onSubmit={submitWithdrawal}>
            <label class='field'>
              <span>CRYPTOCURRENCY</span>
              <select value={coin()} onChange={event => {
                setCoin(event.currentTarget.value);
                setMessage(null);
              }}>
                <option value='SOL'>SOL (Solana)</option>
                <option value='USDT'>USDT (Tether)</option>
                <option value='TRX'>TRX (Tron)</option>
                <option value='LTC'>LTC (Litecoin)</option>
                <option value='DOGE'>DOGE (Dogecoin)</option>
                <option value='ETH'>ETH (Ethereum)</option>
                <option value='BNB'>BNB (BNB Chain)</option>
                <option value='USDC'>USDC (USD Coin)</option>
              </select>
            </label>

            <label class='field'>
              <span>AMOUNT TO WITHDRAW (USD)</span>
              <div class='amount-input'>
                <span aria-hidden='true'>$</span>
                <input
                  type='number'
                  value={amount()}
                  onInput={event => setAmount(event.currentTarget.value)}
                  placeholder='0.00'
                  min='0.01'
                  max={user()?.balance || 0}
                  step='0.01'
                  required
                />
              </div>
            </label>

            <label class='field'>
              <span>DESTINATION WALLET ADDRESS</span>
              <input
                type='text'
                value={address()}
                onInput={event => setAddress(event.currentTarget.value)}
                placeholder='Enter the wallet address to receive your crypto'
                maxlength='255'
                autocomplete='off'
                required
              />
            </label>

            <Show when={message()}>
              <p class={`form-message ${message().type}`} role='status' aria-live='polite'>
                {message().text}
              </p>
            </Show>

            <button class='submit-button bevel-purple' type='submit' disabled={submitting()}>
              {submitting() ? "SUBMITTING..." : "SUBMIT WITHDRAWAL"}
            </button>
          </form>
        </section>
      </main>

      <style jsx>{`
        .payments-page {
          width: 100%;
          max-width: 1175px;
          min-height: calc(100vh - 130px);
          padding: 38px 20px;
          margin: 0 auto;
        }

        .payments-panel {
          width: 100%;
          max-width: 620px;
          padding: 34px;
          margin: 0 auto;
          border: 1px solid #9d4edd;
          border-radius: 12px;
          background: #1a0b2e;
          box-shadow: 0 16px 50px rgba(0, 0, 0, 0.28), 0 0 30px rgba(157, 78, 221, 0.08);
        }

        .panel-header {
          margin-bottom: 24px;
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

        .balance-card {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 18px 20px;
          margin-bottom: 24px;
          border: 1px solid rgba(157, 78, 221, 0.55);
          border-radius: 8px;
          background: rgba(11, 4, 20, 0.65);
          text-align: center;
        }

        .balance-card span {
          color: #b3a1c6;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .balance-card strong {
          color: #fff;
          font-size: 28px;
          font-variant-numeric: tabular-nums;
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
        input {
          width: 100%;
          min-height: 48px;
          padding: 0 14px;
          border: 1px solid #9d4edd;
          border-radius: 6px;
          outline: none;
          background: rgba(11, 4, 20, 0.85);
          color: #fff;
          font: 500 14px "Geogrotesque Wide", sans-serif;
        }

        select:focus,
        input:focus {
          border-color: var(--highlight-purple, #c77dff);
          box-shadow: 0 0 0 3px rgba(157, 78, 221, 0.16);
        }

        select option {
          background: #1a0b2e;
        }

        input::placeholder {
          color: #78688b;
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

          h1 {
            font-size: 21px;
          }
        }
      `}</style>
    </>
  );
}

export default Withdraws;
