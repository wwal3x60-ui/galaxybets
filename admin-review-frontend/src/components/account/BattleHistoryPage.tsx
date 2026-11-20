"use client";

import { useState, useEffect, useMemo } from "react";
import { Pagination } from "@heroui/react";
import { type Battle } from "@/lib/api/battles";
import { getBattleHistory } from "@/lib/api/battle-history";
import { BattleHistoryCard } from "@/components/battles/BattleHistoryCard";
import { useRouter } from "next/navigation";

const ITEMS_PER_PAGE = 10;

export function BattleHistoryPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const fetchBattleHistory = async () => {
      setIsLoading(true);
      try {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const data = await getBattleHistory({ limit: ITEMS_PER_PAGE, offset });
        setBattles(data.battles ?? []);
        setTotal(data.total ?? 0);
      } catch (error) {
        console.error("Error fetching battle history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBattleHistory();
  }, [page]);

  const handleViewResults = (battleId: string) => {
    router.push(`/battles/${battleId}`);
  };

  const pages = useMemo(() => Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)), [total]);
  const startItem = total === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, total);

  if (isLoading) {
    return (
      <div className="flex flex-col items-start gap-10 w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Battle History
        </h2>
        <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Loading battle history...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-10 w-full">
      <div className="flex flex-row items-center justify-between w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Battle History
        </h2>
        {total > 0 && (
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
            Showing {startItem}–{endItem} of {total}
          </span>
        )}
      </div>
      <div className="flex flex-col items-start gap-5 w-full">
        {battles.map((battle, index) => (
          <div key={battle.id} className="w-full">
            <BattleHistoryCard battle={battle} onViewResults={handleViewResults} />
            {index < battles.length - 1 && (
              <div className="w-full h-px bg-[rgba(63,71,84,0.24)] mt-5" />
            )}
          </div>
        ))}
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
