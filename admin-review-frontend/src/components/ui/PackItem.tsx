"use client";

import { useState } from "react";
import type { PackItem } from "@/lib/api/packs";
import { useModalStore } from "@/store/modal.store";
import styles from "./PackItem.module.css";

type Props = Partial<PackItem> & {
  item?: PackItem;
  className?: string;
  onClick?: () => void;
};

export function getItemOdds(item: Partial<PackItem>): number | null {
  const first = Number(item.startTicket);
  const last = Number(item.endTicket);
  if (Number.isInteger(first) && Number.isInteger(last) && first >= 1 && last >= first && last <= 100000) {
    return (last - first + 1) / 100000;
  }
  const raw = item.metadata?.probability;
  if (raw !== null && raw !== undefined) {
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
  }
  return null;
}

export default function PackItemCard(props: Props) {
  const reward = props.item ?? props;
  const [failed, setFailed] = useState(false);
  const name = reward.template?.name || reward.name || "Item";
  const image = reward.template?.imageUrl || reward.image || "";
  const rawValue = reward.template?.value ?? reward.price ?? "0";
  const value = Number(String(rawValue).replace(/[^0-9.-]/g, ""));
  const price = Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
    : "Unavailable";
  const odds = getItemOdds(reward);
  const oddsText = odds === null ? "Unavailable" : `${(odds * 100).toFixed(3)}%`;

  function openItem() {
    if (props.onClick) return props.onClick();
    useModalStore.getState().open("pack-item", {
      item: reward,
      ticketRange: reward.startTicket != null && reward.endTicket != null
        ? { startTicket: reward.startTicket, endTicket: reward.endTicket }
        : null,
    });
  }

  return (
    <button
      type="button"
      className={`${styles.card} ${props.className || ""}`}
      onClick={openItem}
      aria-label={`${name}, ${price}, odds ${oddsText}`}
      title={name}
    >
      <span className={styles.odds}>
        <span>Odds</span><strong>{oddsText}</strong>
      </span>
      <span className={styles.art}>
        {image && !failed
          ? <img src={image} alt={name} loading="lazy" onError={() => setFailed(true)} />
          : <span className={styles.missing}>Image unavailable</span>}
      </span>
      <span className={styles.name}>{name}</span>
      <span className={styles.price}>{price}</span>
    </button>
  );
}
