"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {loadUiSvg} from "@/lib/utils/ui-svg";
import { cn } from "@/lib/utils/cn";

interface SocialIconProps {
  name: string;
  href: string;
  icon: string;
  size?: "mobile" | "desktop";
}

export function SocialIcon({ name, href, icon, size = "desktop" }: SocialIconProps) {
  const [svgContent, setSvgContent] = useState<string>("");
  const isMobile = size === "mobile";

  useEffect(() => {
    loadUiSvg(icon)
      .then((text) => {
        // Social icons always use muted color (#6c6c71)
        // The SVG files already have the correct color, so we can use them as-is
        setSvgContent(text);
      })
      .catch((err) => {
        setSvgContent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="M8 12h8m-4-4 4 4-4 4"/></svg>');
      });
  }, [icon]);

  if (!svgContent) {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center justify-center rounded-md",
          "hover:bg-surface-secondary transition-colors",
          isMobile 
            ? "w-10 h-10 p-2.5" 
            : "w-7 h-7 p-2.5"
        )}
        aria-label={name}
      >
        <div className={cn(
          "flex items-center justify-center",
          isMobile ? "w-6 h-6" : "w-5 h-5"
        )} />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-center rounded-md",
        "hover:bg-surface-secondary transition-colors",
        isMobile 
          ? "w-10 h-10 p-2.5" 
          : "w-7 h-7 p-2.5"
      )}
      aria-label={name}
    >
      <div 
        className={cn(
          "flex items-center justify-center",
          isMobile ? "w-6 h-6" : "w-5 h-5"
        )}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </Link>
  );
}
