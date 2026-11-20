"use client";

import { Icon } from "@/components/ui/Icon";
import { Button, Card, Image, Skeleton } from "@heroui/react";
import { cn } from "@/lib/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLiveBattles } from "@/lib/api/live-battles";
import { useWebSocket, type BattleHighlightItem, type BattleNewEvent } from "@/lib/websocket";
import Link from "next/link";
import BattleCard from "../battles/BattleCard";
import { Battle, mapBackendBattleToBattle } from "@/lib/api/battles";

interface BattleCardProps {
  mode: string;
  modeColor: string;
  players: Array<{ avatar: string, name: string }>;
  packs: Array<{ name: string; image: string }>;
  cost: string;
  unboxed: string;
  gradient?: string;
}



export default function BattleHighlightsSection() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading,setLoading]=useState(true);
  const latestIdRef = useRef<string | null>(null);
  const limit = 3;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getLiveBattles(limit);
        if (cancelled) return;
        setBattles(data);
        setLoading(false);
      } catch {
        if(!cancelled)setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const header = useMemo(() => {
    return (
      <div className="flex flex-row justify-between items-center w-full">
        <div className="flex flex-row items-center gap-1 rounded-full">
          <span className="text-lg leading-[17px] tracking-[-0.02em] font-medium text-white whitespace-nowrap">
            Battle Highlights
          </span>
          <Icon name="adventure" className="w-5 h-5" isActive/>
        </div>
        <button className="flex flex-row justify-center items-center gap-1 px-3 py-2.5 rounded-full whitespace-nowrap">
          <Link href="/battles" className="text-base leading-[15px] tracking-[-0.02em] font-medium text-white">
            See all
          </Link>
          <Icon name="chevron-right" className="w-4 h-4" />
        </button>
      </div>
    );
  }, []);

  return (
    <div className="flex flex-col items-start gap-6 w-full">
      {header}

      <div className="flex flex-col items-start gap-5 w-full overflow-x-auto scrollbar-hide">
         {battles.length > 0 ? <AnimatePresence initial={false}>
          {battles?.map((battle) => (
            <motion.div
              key={battle.id}
              layout
              initial={{ opacity: 0, y: -10, scale: 0.99 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                boxShadow: latestIdRef.current === battle.id ? "0 0 0 1px rgba(40,199,111,0.35)" : "none",
              }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="w-full"
            >
              <BattleCard battle={battle} />
            </motion.div>
          ))}
        </AnimatePresence>
          : 
          <p className="text-sm text-text-muted" role="status">{loading?'Loading battles…':'No battles available right now. Create one or check the battles lobby.'}</p>}

      </div>
    </div>
  );
}
