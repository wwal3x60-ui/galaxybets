"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Pagination,
  Button,
} from "@heroui/react";
import {
  claimCommissionEarning,
  getCommissionEarnings,
  type CommissionEarning,
} from "@/lib/api/commission";
import { getWalletBalance } from "@/lib/api/wallet";
import { useAuthStore } from "@/store/auth.store";
import { formatCurrency } from "@/lib/utils/numbers";

const ITEMS_PER_PAGE = 10;

function formatDate(d?: string | null): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

function formatUsd(amount?: string | null): string {
  return `$${formatCurrency(amount ?? "0")}`;
}

export function CommissionPage() {
  const { updateUser } = useAuthStore();
  const [earnings, setEarnings] = useState<CommissionEarning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"UNCLAIMED" | "CLAIMED">("UNCLAIMED");
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)), [total]);

  useEffect(() => {
    const fetchEarnings = async () => {
      setIsLoading(true);
      try {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const data = await getCommissionEarnings({
          status,
          limit: ITEMS_PER_PAGE,
          offset,
        });
        setEarnings(data.earnings ?? []);
        setTotal(data.total ?? 0);
      } catch (error) {
        console.error("Error fetching commission earnings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEarnings();
  }, [page, status]);

  const handleClaim = async (earningId: string) => {
    setClaimingId(earningId);
    try {
      await claimCommissionEarning(earningId);

      // Refresh wallet balance so header/account UI updates immediately
      try {
        const wallet = await getWalletBalance();
        if (wallet?.balance != null) {
          updateUser({ walletBalance: wallet.balance });
        }
      } catch {
        // ignore balance refresh errors; websocket may still update it
      }

      const offset = (page - 1) * ITEMS_PER_PAGE;
      const data = await getCommissionEarnings({
        status,
        limit: ITEMS_PER_PAGE,
        offset,
      });
      setEarnings(data.earnings ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error("Error claiming commission:", error);
    } finally {
      setClaimingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-start gap-10 w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Commission
        </h2>
        <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Loading commission...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-10 w-full">
      <div className="flex flex-row items-center justify-between w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Commission
        </h2>
        <div className="flex flex-row items-center gap-2">
          <Button
            size="sm"
            className={`${status === "UNCLAIMED" ? "mcPrimary" : "bg-transparent"}`}
            onPress={() => {
              setPage(1);
              setStatus("UNCLAIMED");
            }}
          >
            Unclaimed
          </Button>
          <Button
            size="sm"
            className={`${status === "CLAIMED" ? "mcPrimary" : "bg-transparent"}`}
            onPress={() => {
              setPage(1);
              setStatus("CLAIMED");
            }}
          >
            Claimed
          </Button>
        </div>
      </div>

      <div className="grid items-end gap-5 w-full">
        <Table
          aria-label="Commission table"
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
            <TableColumn key="pack" className="text-left w-[30%] pl-2">
              Case
            </TableColumn>
            <TableColumn key="opener" className="text-center w-[20%] py-3">
              Opened By
            </TableColumn>
            <TableColumn key="openedAt" className="text-center w-[25%]">
              Opened At
            </TableColumn>
            <TableColumn key="amount" className="text-center w-[15%]">
              Commission
            </TableColumn>
            <TableColumn key="action" className="text-right pr-2 w-[10%]">
              Action
            </TableColumn>
          </TableHeader>
          <TableBody emptyContent="No commission earnings found.">
            {earnings.map((earning) => (
              <TableRow key={earning.id}>
                <TableCell className="text-left py-2">
                  <span className="text-white whitespace-nowrap">
                    {earning.pack?.name ?? earning.packId}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-white whitespace-nowrap">
                    {earning.opener?.username ?? "-"}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-white whitespace-nowrap">
                    {formatDate(earning.accruedAt)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-white whitespace-nowrap">
                    {formatUsd(earning.amount)}
                  </span>
                </TableCell>
                <TableCell className="text-right pr-2">
                  {status === "UNCLAIMED" ? (
                    <Button
                      size="sm"
                      className="bg-transparent text-primary-400"
                      isLoading={claimingId === earning.id}
                      onPress={() => handleClaim(earning.id)}
                    >
                      Claim
                    </Button>
                  ) : (
                    <span className="text-[#6c6c71]">-</span>
                  )}
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
