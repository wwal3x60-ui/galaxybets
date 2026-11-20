"use client";

import { Icon } from "@/components/ui/Icon";
import { Image } from "@heroui/react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLiveUpgrades } from "@/lib/api/live-upgrades";
import { useWebSocket, type UpgradeHighlightItem, type UpgradeNewEvent } from "@/lib/websocket";

interface UpgraderCardProps {
  name: string;
  price: string;
  multiplier: string;
  image: string;
  user: { avatar: string, name: string };
}

function UpgraderCard({ name, price, multiplier, image, user }: UpgraderCardProps) {
  return (
    <div className="w-[150.4px] h-[150.4px] bg-[rgba(63,71,84,0.12)] rounded-lg relative shrink-0">
      <div className="absolute w-[134.4px] h-5 left-2 top-2 flex flex-row justify-between items-center gap-[45px]">
        <Image src={user.avatar} alt={user.name} width={20} height={20} className="w-5 h-5 rounded-full" />
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-warning-base">
          {multiplier}
        </span>
      </div>

      <div className="absolute w-[60px] h-[60px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -mt-[11.7px]">
        <Image src={image} alt={name} width={60} height={60} className="w-full h-full object-cover rounded" />
      </div>

      <div className="absolute w-[88px] h-8 left-1/2 top-[110px] -translate-x-1/2 flex flex-col items-center gap-0.5">
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-text-muted whitespace-nowrap truncate w-10/12 text-center">
          {name}
        </span>
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white text-center">
          {price}
        </span>
      </div>
    </div>
  );
}

export default function UpgraderHighlightsSection() {
  const [upgraders, setUpgraders] = useState<UpgradeHighlightItem[]>([]);
  const latestIdRef = useRef<string | null>(null);
  const limit = 5;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getLiveUpgrades(limit);
        if (cancelled) return;
        setUpgraders(data);
      } catch {
        // ignore (homepage should still render)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pushNew = (item: UpgradeHighlightItem) => {
    latestIdRef.current = item.id;
    setUpgraders((prev) => {
      const next = [item, ...prev.filter((x) => x.id !== item.id)];
      return next.slice(0, limit);
    });
  };

  useWebSocket({
    onUpgradeNew: (data: UpgradeNewEvent) => {
      if (!data?.item?.id) return;
      pushNew(data.item);
    },
  });

  const header = useMemo(() => {
    return (
      <div className="flex flex-row justify-between items-center w-full">
        <div className="flex flex-row items-center gap-1 rounded-full">
          <span className="text-lg leading-[17px] tracking-[-0.02em] font-medium text-white">
            Upgrader Highlights
          </span>
          <Icon name="start-up" className="w-5 h-5" isActive/>
        </div>
        <button className="flex flex-row justify-center items-center gap-1 px-3 py-2.5 rounded-full">
          <Link href="/upgrader" className="text-base leading-[15px] tracking-[-0.02em] font-medium text-white">
            See all
          </Link>
          <Icon name="chevron-right" className="w-4 h-4" />
        </button>
      </div>
    );
  }, []);

  if(!upgraders.length)return null;
  return (
    <div className="flex flex-col items-start gap-6 w-full">
      {header}

      <div className="flex flex-row items-center gap-3 w-full overflow-auto scrollbar-hide">
        <AnimatePresence initial={false}>
          {upgraders.map((upgrader) => (
            <motion.div
              key={upgrader.id}
              layout
              initial={{ opacity: 0, x: -10, scale: 0.98 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
                boxShadow: latestIdRef.current === upgrader.id ? "0 0 0 1px rgba(40,199,111,0.35)" : "none",
              }}
              exit={{ opacity: 0, x: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            >
              <UpgraderCard {...upgrader} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
