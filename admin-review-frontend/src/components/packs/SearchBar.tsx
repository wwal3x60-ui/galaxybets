"use client";

import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { Accordion } from "@heroui/react";
import { addToast } from "@/lib/toast";
import ActionButton from "../ui/ActionButton";

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  showCreateButton?: boolean;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search Cases",
  showCreateButton = true
}: SearchBarProps) {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const handleCreatePack = () => {
    if (isAuthenticated) {
      router.push("/create-case");
    } else {
      addToast({
        title: "Please login to create a case",
        description: "You need to be logged in to create a case",
        color: "warning",
      });
    }
  };
  return (
    <div className="flex flex-row items-center gap-2 w-full max-w-4xl mx-auto">
      {/* Search Input */}
      <div className="flex flex-row items-center gap-1 px-3 py-0.5 flex-1 h-9 bg-[rgba(63,71,84,0.12)] rounded-full">
        <Icon name="search" className="w-5 h-5 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          aria-label="Search cases"
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-sm leading-[15px] tracking-[-0.02em] font-medium text-text-muted placeholder:text-text-muted"
        />
      </div>

      {/* Create Pack Button */}
      {showCreateButton && (
        <ActionButton onClick={handleCreatePack}>
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium">
            Create Case
          </span>
          <Icon name="plus" className="w-4 h-4" isActive={true} />
        </ActionButton>
      )}
    </div>
  );
}
