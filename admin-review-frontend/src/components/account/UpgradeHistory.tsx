"use client";

import { useState, useEffect, useMemo } from "react";
import { Image, Pagination } from "@heroui/react";
import { getUpgraderHistory, type UpgraderHistoryItem } from "@/lib/api/upgrader";
import { formatCurrency } from "@/lib/utils/numbers";

const ITEMS_PER_PAGE = 10;

function formatUsd(amount?: string | null): string {
  return `$${formatCurrency(amount ?? "0")}`;
}

export function UpgradeHistory() {
  const [items, setItems] = useState<UpgraderHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const data = await getUpgraderHistory({ limit: ITEMS_PER_PAGE, offset });
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (error) {
        console.error("Error fetching upgrader history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [page]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)), [total]);
  const startItem = total === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, total);

  if (isLoading) {
    return (
      <div className="flex flex-col items-start gap-10 w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Upgrade history
        </h2>
        <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Loading upgrade history...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-10 w-full">
      <div className="flex flex-row items-center justify-between w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Upgrade history
        </h2>
        {total > 0 && (
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
            Showing {startItem}–{endItem} of {total}
          </span>
        )}
      </div>
      <div className="flex flex-col items-start gap-5 w-full">
        {items.map((row, index) => {
          const title = row.productName ?? "Upgrader spin";
          const imageUrl = row.image ?? "/assets/images/pack1.webp";
          const date = new Date(row.createdAt).toLocaleString();
          const price = formatUsd(row.spinPrice);
          return (
          <div key={row.id} className="w-full">
            {/* History Item */}
            <div className="flex flex-row items-end gap-2 w-full h-[100px]">
              {/* Image */}
              <div className="relative w-[100px] h-[100px] bg-[rgba(63,71,84,0.12)] rounded-lg shrink-0">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80px] h-[80px]">
                  <Image
                    src={imageUrl}
                    alt={title}
                    width={80}
                    height={80}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-row justify-between items-end pb-1  flex-1">
                {/* Name and Price */}
                <div className="flex flex-col justify-end items-start gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
                      {title}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        row.won ? "bg-[rgba(16,185,129,0.15)] text-emerald-400" : "bg-[rgba(239,68,68,0.15)] text-red-400"
                      }`}
                    >
                      {row.won ? "WIN" : "LOSS"}
                    </span>
                  </div>
                  <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white text-center">
                    {price}
                  </span>
                </div>

                {/* Date */}
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71] shrink-0">
                  {date}
                </span>
              </div>
            </div>

            {/* Separator */}
            {index < items.length - 1 && (
              <div className="w-full h-px bg-[rgba(63,71,84,0.24)] mt-5" />
            )}
          </div>
          );
        })}
      </div>
      {total > 0 && pages > 1 && (
        <div className="flex flex-row items-center justify-center w-full gap-4 mt-2">
          <Pagination
            total={pages}
            page={page}
            onChange={setPage}
            color="primary"
            showControls
            classNames={{
              wrapper: "gap-1",
              item: "w-8 h-8 min-w-8 text-sm text-white bg-transparent",
              cursor: "bg-primary-400",
              prev: "bg-transparent text-white",
              next: "bg-transparent text-white",
            }}
          />
        </div>
      )}
    </div>
  );
}
