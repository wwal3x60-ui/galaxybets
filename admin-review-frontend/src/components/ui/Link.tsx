import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface CustomLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
  active?: boolean;
}

export function CustomLink({
  href,
  children,
  className,
  external = false,
  active = false,
}: CustomLinkProps) {
  const baseStyles = "transition-colors hover:text-ancient-cyan";
  const activeStyles = active ? "text-ancient-cyan" : "text-foreground";

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(baseStyles, activeStyles, className)}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={cn(baseStyles, activeStyles, className)}>
      {children}
    </Link>
  );
}
