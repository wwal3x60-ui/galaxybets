import {For, onMount, Show, createSignal} from "solid-js";
import {authedAPI, createNotification} from "../../util/api";

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount)
        ? new Intl.NumberFormat(undefined, {style: "currency", currency: "USD"}).format(amount)
        : value ?? "—";
}

function AdminCashier() {
    const [transactions, setTransactions] = createSignal([]);
    const [loading, setLoading] = createSignal(true);
    const [loadError, setLoadError] = createSignal("");
    const [activeTransaction, setActiveTransaction] = createSignal(null);

    async function refreshTransactions() {
        setLoading(true);
        setLoadError("");

        const response = await authedAPI("/admin/cashier/pending", "GET", null, true);
        if (Array.isArray(response?.data)) {
            setTransactions(response.data);
        } else {
            setLoadError(response?.error || "Unable to load pending transactions.");
            if (!response) createNotification("error", "Unable to load pending transactions.");
        }

        setLoading(false);
    }

    onMount(refreshTransactions);

    async function handleTransaction(transaction, action) {
        if (activeTransaction() !== null) return;

        const transactionId = transaction.id;
        const endpoint = action === "reject"
            ? "/admin/cashier/reject"
            : transaction.type === "crypto_deposit"
                ? "/admin/cashier/approve-deposit"
                : "/admin/cashier/approve-withdraw";

        setActiveTransaction(transactionId);
        const response = await authedAPI(
            endpoint,
            "POST",
            JSON.stringify({transactionId}),
            true
        );

        if (response?.success) {
            createNotification(
                action === "reject" ? "error" : "success",
                action === "reject" ? "Transaction rejected." : "Transaction approved."
            );
            await refreshTransactions();
        } else if (!response) {
            createNotification("error", "The transaction could not be updated. Please try again.");
        }

        setActiveTransaction(null);
    }

    return (
        <>
            <section class="cashier-panel">
                <div class="cashier-heading">
                    <div>
                        <h1>Pending Crypto Transactions</h1>
                        <p>Review and process incoming deposits and withdrawal requests.</p>
                    </div>
                    <button class="refresh-button" onClick={refreshTransactions} disabled={loading()}>
                        {loading() ? "Refreshing..." : "Refresh"}
                    </button>
                </div>

                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Date / Time</th>
                                <th>User</th>
                                <th>Type</th>
                                <th>Coin</th>
                                <th>Amount</th>
                                <th>TxHash / Wallet Address</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <Show when={!loading()} fallback={
                                <tr><td class="table-message" colSpan="7">Loading pending transactions...</td></tr>
                            }>
                                <Show when={!loadError()} fallback={
                                    <tr><td class="table-message error-message" colSpan="7">{loadError()}</td></tr>
                                }>
                                    <Show when={transactions().length > 0} fallback={
                                        <tr><td class="table-message" colSpan="7">No pending crypto transactions.</td></tr>
                                    }>
                                        <For each={transactions()}>{(transaction) =>
                                            <tr>
                                                <td>{formatDate(transaction.createdAt)}</td>
                                                <td>
                                                    <span class="username">{transaction.username || "Unknown user"}</span>
                                                    <span class="user-id">ID: {transaction.userId}</span>
                                                </td>
                                                <td>
                                                    <span class={`type-badge ${transaction.type === "crypto_deposit" ? "deposit" : "withdrawal"}`}>
                                                        {transaction.type === "crypto_deposit" ? "Deposit" : "Withdrawal"}
                                                    </span>
                                                </td>
                                                <td>{transaction.coin || "—"}</td>
                                                <td class="amount">{formatAmount(transaction.amount)}</td>
                                                <td>
                                                    <span class="transaction-reference" title={transaction.txHash || ""}>
                                                        {transaction.txHash || "—"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div class="actions">
                                                        <button
                                                            class="approve-button"
                                                            onClick={() => handleTransaction(transaction, "approve")}
                                                            disabled={activeTransaction() !== null}
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            class="reject-button"
                                                            onClick={() => handleTransaction(transaction, "reject")}
                                                            disabled={activeTransaction() !== null}
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        }</For>
                                    </Show>
                                </Show>
                            </Show>
                        </tbody>
                    </table>
                </div>
            </section>

            <style jsx>{`
              .cashier-panel {
                color: #fff;
                background: #1a0b2e;
                border: 1px solid #9d4edd;
                border-radius: 8px;
                padding: 22px;
                box-shadow: 0 8px 26px rgba(0, 0, 0, 0.22);
              }

              .cashier-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 20px;
              }

              h1 {
                margin: 0;
                font-size: 20px;
                font-weight: 700;
              }

              .cashier-heading p {
                color: #c9b8dc;
                font-size: 13px;
                margin: 6px 0 0;
              }

              .refresh-button, .approve-button, .reject-button {
                border: 1px solid #9d4edd;
                border-radius: 5px;
                color: #fff;
                cursor: pointer;
                font: inherit;
                font-size: 12px;
                font-weight: 700;
                padding: 9px 12px;
                transition: opacity 0.15s ease, transform 0.15s ease;
              }

              .refresh-button {
                background: #32154b;
              }

              .approve-button {
                background: #25834b;
                border-color: #3ab76b;
              }

              .reject-button {
                background: #8d3348;
                border-color: #d34b69;
              }

              button:hover:not(:disabled) {
                transform: translateY(-1px);
              }

              button:disabled {
                cursor: wait;
                opacity: 0.55;
              }

              .table-scroll {
                overflow-x: auto;
              }

              table {
                border-collapse: collapse;
                min-width: 930px;
                width: 100%;
              }

              th {
                background: #2b1241;
                color: #d9b8f5;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.04em;
                padding: 12px 10px;
                text-align: left;
                white-space: nowrap;
              }

              th:first-child {
                border-radius: 5px 0 0 5px;
              }

              th:last-child {
                border-radius: 0 5px 5px 0;
              }

              td {
                border-bottom: 1px solid rgba(157, 78, 221, 0.3);
                color: #fff;
                font-size: 12px;
                padding: 13px 10px;
                vertical-align: middle;
              }

              .username, .user-id {
                display: block;
              }

              .username {
                font-weight: 700;
              }

              .user-id {
                color: #b6a0cb;
                font-size: 10px;
                margin-top: 3px;
              }

              .type-badge {
                border: 1px solid;
                border-radius: 20px;
                display: inline-block;
                font-size: 10px;
                font-weight: 700;
                padding: 4px 8px;
              }

              .deposit {
                background: rgba(58, 183, 107, 0.14);
                border-color: #3ab76b;
                color: #78e69f;
              }

              .withdrawal {
                background: rgba(211, 75, 105, 0.14);
                border-color: #d34b69;
                color: #ff91a7;
              }

              .amount {
                font-weight: 700;
                white-space: nowrap;
              }

              .transaction-reference {
                color: #d4b8ef;
                display: block;
                max-width: 230px;
                overflow-wrap: anywhere;
                user-select: text;
              }

              .actions {
                display: flex;
                gap: 7px;
              }

              .table-message {
                color: #c9b8dc;
                padding: 30px 12px;
                text-align: center;
              }

              .error-message {
                color: #ff91a7;
              }

              @media (max-width: 650px) {
                .cashier-panel {
                  padding: 14px;
                }

                .cashier-heading {
                  align-items: flex-start;
                }

                h1 {
                  font-size: 17px;
                }
              }
            `}</style>
        </>
    );
}

export default AdminCashier;
