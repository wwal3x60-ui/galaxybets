"use client";

import { useState, useEffect, useMemo } from "react";
import { Image, Pagination } from "@heroui/react";
import { getPackHistory, type PackHistoryItem } from "@/lib/api/packs";

const ITEMS_PER_PAGE = 10;

export function PackHistory() {
  const [items, setItems] = useState<PackHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const data = await getPackHistory({ limit: ITEMS_PER_PAGE, offset });
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (error) {
        console.error("Error fetching case history:", error);
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
          Case history
        </h2>
        <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Loading case history...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-10 w-full">
      <div className="flex flex-row items-center justify-between w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Case history
        </h2>
        {total > 0 && (
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
            Showing {startItem}–{endItem} of {total}
          </span>
        )}
      </div>
      <div className="flex flex-col items-start gap-5 w-full">
        {items.map((row, index) => {
          const title = row.packName?.replace(/\bpacks?\b/gi, "Case") ?? "Case";
          const imageUrl = row.packImageUrl ?? "/assets/images/pack1.webp";
          const date = row.openedAt ? new Date(row.openedAt).toLocaleString() : "-";
          return (
            <div key={row.id} className="w-full">
              <div className="flex flex-row items-end gap-2 w-full h-[100px]">
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

                <div className="flex flex-row justify-between items-end pb-1 flex-1">
                  <div className="flex flex-col justify-end items-start gap-1">
                    <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
                      {title}
                    </span>
                    <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
                      Opened {date}
                    </span>
                  </div>
                </div>
              </div>

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
