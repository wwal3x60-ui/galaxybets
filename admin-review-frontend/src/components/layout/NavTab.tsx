"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";

interface NavTabProps {
  label: string;
  href: string;
  isActive: boolean;
  icon?: string;
}

export function NavTab({ label, href, isActive, icon }: NavTabProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-row items-center gap-1 px-3 py-0.5 h-8 rounded-full transition-colors",
        isActive
          ? "bg-tab-active-bg text-white"
          : "bg-transparent text-text-muted hover:text-white"
      )}
    >
      <span className="text-sm font-medium leading-[15px] tracking-[-0.02em]">
        {label}
      </span>
      {icon && <Icon name={icon} isActive={isActive} />}
    </Link>
  );
}
