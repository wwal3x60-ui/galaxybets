"use client";

import { useState, useEffect, useMemo } from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Image, Snippet, Pagination, Button } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { type DepositRequest, getDeposits, refreshDepositStatus } from "@/lib/api/deposits";
import { useWebSocket } from "@/lib/websocket";
import { formatPriceDisplay } from "@/lib/utils/format";

// Type alias for compatibility with existing code
type Deposit = DepositRequest & {
  methodIcon?: string;
  method?: string;
  amountUSD?: string;
  transactionId?: string;
};

/**
 * Format date to yyyy-mm-dd HH:MM format
 */
function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return date.toString(); // Return original if invalid date

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

const ITEMS_PER_PAGE = 10;

export function DepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchDeposits = async () => {
      setIsLoading(true);
      try {
        const data = await getDeposits();
        setDeposits(data);
      } catch (error) {
        console.error("Error fetching deposits:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeposits();
  }, []);

  // Listen to WebSocket events for real-time deposit status updates
  useWebSocket({
    onDepositStatusUpdated: (data) => {
      // Update the deposit in the list when status changes
      setDeposits((prev) =>
        prev.map((deposit) =>
          deposit.id === data.depositId
            ? { ...deposit, status: data.status as DepositRequest["status"], amount: data.amount || deposit.amount }
            : deposit
        )
      );
    },
  });

  const getStatusColor = (status: Deposit["status"]) => {
    switch (status) {
      case "PENDING":
        return "#FF9F43";
      case "PROCESSING":
        return "#FF9F43";
      case "COMPLETED":
        return "#28C76F";
      case "FAILED":
        return "#FF5C5C";
      default:
        return "#6c6c71";
    }
  };

  const getStatusLabel = (status: Deposit["status"]) => {
    switch (status) {
      case "PENDING":
        return "Pending";
      case "PROCESSING":
        return "Processing";
      case "COMPLETED":
        return "Completed";
      case "FAILED":
        return "Failed";
      default:
        return status;
    }
  };

  // Pagination logic
  const pages = Math.ceil(deposits.length / ITEMS_PER_PAGE);
  const paginatedDeposits = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return deposits.slice(start, end);
  }, [deposits, page]);

  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  const handleRefresh = async (depositId: string, paymentId: string) => {
    if (!paymentId || refreshingIds.has(depositId)) {
      return;
    }

    setRefreshingIds((prev) => new Set(prev).add(depositId));
    try {
      const updatedDeposit = await refreshDepositStatus(depositId);

      // Update the deposit in the list
      setDeposits((prev) =>
        prev.map((deposit) => (deposit.id === depositId ? updatedDeposit : deposit))
      );
    } catch (error) {
      console.error("Error refreshing deposit status:", error);
      // You could show a toast notification here
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(depositId);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-start gap-10 w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Deposits
        </h2>
        <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Loading deposits...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-10 w-full">
      <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
        Deposits
      </h2>
      <div className="grid items-end gap-5 w-full">
        <Table
          aria-label="Deposits table"
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
            <TableColumn key="number" className="text-center w-[5%]">#</TableColumn>
            <TableColumn key="method" className=" text-left pl-2 w-[10%]" >Method</TableColumn>
            <TableColumn key="amount" className=" text-center py-3 w-[20%]">Amount</TableColumn>
            <TableColumn key="transactionId" className=" text-center w-[30%]">Transaction ID</TableColumn>
            <TableColumn key="date" className=" text-center w-[15%]">Date</TableColumn>
            <TableColumn key="status" className=" text-center w-[10%]">Status</TableColumn>
            <TableColumn key="action" className=" text-right w-[10%] pr-2">Action</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No deposits found.">
            {paginatedDeposits.map((deposit, index) => (
              <TableRow key={index}>
                <TableCell className="text-center py-2">
                  <span className="text-white whitespace-nowrap">
                    {(page - 1) * ITEMS_PER_PAGE + index + 1}
                  </span>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex flex-col items-start gap-2.5 w-[80px] h-8 px-2">
                    <div className="w-5 h-5">
                      <Image
                        src={`/assets/icons/${deposit.metadata.pay_currency}.svg`}
                        alt={deposit.method}
                        className="w-8 h-8"
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-white whitespace-nowrap px-2">
                    {(() => {
                      const n = Number(deposit?.metadata?.credited_usd);
                      return Number.isFinite(n) ? formatPriceDisplay(n) : "------";
                    })()}
                  </span>
                  {deposit.metadata?.bonus_code&&<div className="mt-2 space-y-1 text-xs text-teal-200"><p>{deposit.metadata.bonus_code}: {deposit.metadata.bonus_status==='awarded'?`+$${Number(deposit.metadata.bonus_amount).toFixed(2)} bonus credited`:deposit.metadata.bonus_status==='pending'?'Bonus pending eligibility review':deposit.metadata.bonus_status==='rejected'?'Bonus request rejected':'Bonus not awarded: first-deposit eligibility was not met'}</p>{deposit.metadata.bonus_status==='awarded'&&<p>${Number(deposit.metadata.bonus_wager).toFixed(2)} wagering required (1.8× deposit + bonus)</p>}</div>}
                </TableCell>
                <TableCell className="text-center">
                  <Snippet symbol="" variant="solid" className="text-white whitespace-nowrap px-2" classNames={{
                    base: "bg-transparent",
                    pre: "truncate max-w-[200px]",
                  }}>
                    {deposit.intentId || "------"}
                  </Snippet>
                </TableCell>
                <TableCell>
                  <span className="text-white whitespace-nowrap px-2">{formatDate(deposit.createdAt)}</span>
                </TableCell>
                <TableCell>
                  <span
                    style={{ color: getStatusColor(deposit.status) }}
                    className="whitespace-nowrap px-2"
                  >
                    {getStatusLabel(deposit.status)}
                  </span>
                </TableCell>
                <TableCell className="text-center flex items-center justify-center">
                  {deposit?.metadata?.nowpayments.lastStatus !== "FINISHED" && <Button
                    className="min-w-0 bg-transparent"
                    isDisabled={!deposit.metadata?.payment_id || refreshingIds.has(deposit.id)}
                    isLoading={refreshingIds.has(deposit.id)}
                    onPress={() => handleRefresh(deposit.id, deposit.metadata?.payment_id)}
                  >
                    {<Image
                      src={`/assets/icons/refresh.svg`}
                      alt="refresh"
                      width={20}
                      height={20}
                      className={`w-6 h-6 object-contain ${refreshingIds.has(deposit.id) ? 'hidden' : ''}`}
                    />}
                  </Button>}
                </TableCell>
              </TableRow>
            ))}
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
