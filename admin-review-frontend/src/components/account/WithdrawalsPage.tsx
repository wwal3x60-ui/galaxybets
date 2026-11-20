"use client";

import { useState, useEffect } from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Image, Pagination, Snippet } from "@heroui/react";
import { getWithdrawalRequests, type WithdrawalRequest, type WithdrawalStatus } from "@/lib/api/withdrawals";
import { formatCurrency } from "@/lib/utils/numbers";

const ITEMS_PER_PAGE = 10;

function tokenToIcon(token?: string | null): string {
  const t = (token ?? "").toLowerCase();
  if (t === "sol") return "solana";
  return t || "usdt";
}

function tokenLabel(token?: string | null): string {
  const t = (token ?? "").toUpperCase();
  return t || "N/A";
}

function formatDate(d?: string | null): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

function truncateMiddle(s: string, head = 6, tail = 4): string {
  if (!s) return "-";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

function statusColor(status: WithdrawalStatus): string {
  switch (status) {
    case "PENDING":
      return "#FF9F43";
    case "PROCESSING":
      return "#d83e4a";
    case "COMPLETED":
      return "#28C76F";
    case "FAILED":
      return "#FF5C5C";
    default:
      return "#6c6c71";
  }
}

function statusLabel(status: WithdrawalStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "PROCESSING":
      return "Processing";
    case "COMPLETED":
      return "Confirmed";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

export function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchWithdrawals = async () => {
      setIsLoading(true);
      try {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const data = await getWithdrawalRequests({ limit: ITEMS_PER_PAGE, offset });
        setWithdrawals(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (error) {
        console.error("Error fetching withdrawals:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWithdrawals();
  }, [page]);

  // Pagination logic (server-side)
  const pages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  if (isLoading) {
    return (
      <div className="flex flex-col items-start gap-10 w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Withdrawals
        </h2>
        <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Loading withdrawals...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-10 w-full">
      <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
        Withdrawals
      </h2>
      <div className="grid overflow-x-auto items-end gap-5 w-full">
        <Table
          aria-label="Withdrawals table"
          classNames={{
            base: "grid",
            wrapper: "bg-transparent shadow-none",
            table: "min-w-full",
            thead: "bg-transparent",
            th: "px-0 py-0 text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71] border-b border-[rgba(63,71,84,0.24)] h-[15px]",
            tbody: "bg-transparent",
            tr: "h-5 border-b border-[rgba(63,71,84,0.24)]",
            td: "px-0 py-0 text-sm leading-[15px] tracking-[-0.02em] font-medium",
          }}
        >
          <TableHeader>
            <TableColumn key="number" className="text-left pl-2 w-[5%]">#</TableColumn>
            <TableColumn key="method" className="text-left pl-2 w-[10%]">Method</TableColumn>
            <TableColumn key="amount" className="text-center py-3 w-[15%]">Amount</TableColumn>
            <TableColumn key="address" className="text-center w-[25%]">Address</TableColumn>
            <TableColumn key="transaction" className="text-center w-[25%]">Transaction</TableColumn>
            <TableColumn key="date" className="text-center w-[10%]">Date</TableColumn>
            <TableColumn key="status" className="text-right pr-2 w-[10%]">Status</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No withdrawals found.">
            {withdrawals.map((withdrawal, index) => {
              const token = (withdrawal.metadata as any)?.token ?? null;
              const icon = tokenToIcon(token);
              const amountUsd = `$${formatCurrency(withdrawal.amount ?? "0")}`;
              const when = withdrawal.requestedAt ?? withdrawal.createdAt ?? null;

              return (
                <TableRow key={withdrawal.id}>
                  <TableCell className="text-center py-2">
                    <span className="text-white whitespace-nowrap">
                      {(page - 1) * ITEMS_PER_PAGE + index + 1}
                    </span>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col items-center h-5">
                      <div className="w-5 h-5">
                        <Image
                          src={`/assets/icons/${icon}.svg`}
                          alt={tokenLabel(token)}
                          width={20}
                          height={20}
                          className="w-5 h-5"
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-white whitespace-nowrap px-2">
                      {amountUsd} ({tokenLabel(token)})
                    </span>
                  </TableCell>
                  <TableCell>
                    <Snippet size="sm"
                      symbol=""
                      className="bg-transparent"
                      classNames={{
                        pre: "w-20 whitespace-normal truncate",
                        content: "text-text-muted w-8",
                      }}>{withdrawal.destinationAddress}</Snippet>
                  </TableCell>
                  <TableCell>
                    <Snippet size="sm"
                      symbol=""
                      className="bg-transparent"
                      classNames={{
                        pre: "w-20 whitespace-normal truncate",
                        content: "text-text-muted w-8",
                      }}>{withdrawal.metadata?.txHash ?? "-"}</Snippet>
                  </TableCell>
                  <TableCell>
                    <span className="text-white whitespace-nowrap px-2">{formatDate(when)}</span>
                  </TableCell>
                  <TableCell>
                    <span
                      style={{ color: statusColor(withdrawal.status) }}
                      className="whitespace-nowrap px-2"
                    >
                      {statusLabel(withdrawal.status)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {pages > 1 && (
          <div className="flex justify-center mt-4">
            <Pagination
              total={pages}
              page={page}
              onChange={setPage}
              color="primary"
              classNames={{
                wrapper: "gap-0",
                item: "w-8 h-8 text-sm text-white bg-transparent",
                cursor: "bg-primary-400",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
