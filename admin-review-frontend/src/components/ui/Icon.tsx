"use client";
import { forwardRef, useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { loadUiSvg } from "@/lib/utils/ui-svg";
import { cn } from "@/lib/utils/cn";
import UiGlyph, { hasUiGlyph } from "./UiGlyph";

type IconProps = {
  name: string;
  isActive?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
} & Omit<ComponentPropsWithoutRef<"div">, "children">;

export const Icon = forwardRef<HTMLDivElement, IconProps>(function Icon(
  { name, className, isActive = false, size = "sm", ...divProps }, ref,
) {
  const inline = hasUiGlyph(name);
  const [loaded, setLoaded] = useState({ name: "", svg: "" });
  const sizes = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6", xl: "w-32 h-32" };
  useEffect(() => {
    if (inline) return;
    let cancelled = false;
    // Preserve specialized assets such as currency and social logos.
    loadUiSvg(name).then(svg => {
      if (!cancelled) setLoaded({ name, svg });
    }).catch(() => { if (!cancelled) setLoaded({ name, svg: "" }); });
    return () => { cancelled = true; };
  }, [name, inline]);
  const svg = loaded.name === name ? loaded.svg : "";
  const props = { ...divProps, ref, className: cn(sizes[size], "gxUiIcon flex shrink-0 items-center justify-center", isActive && "text-white", className) };
  if (inline || !svg) return <div {...props}><UiGlyph name={inline ? name : "games"} size="100%"/></div>;
  return <div {...props} dangerouslySetInnerHTML={{ __html: svg }}/>;
});
