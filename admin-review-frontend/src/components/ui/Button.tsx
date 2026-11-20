import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Button as HeroButton } from "@heroui/react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  disabled,
  formAction,
  value,
  ...props
}: ButtonProps) {
  const baseStyles = 
    "inline-flex flex-row items-center justify-center font-sans font-semibold transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none";
  
  // Desktop styles: height 36px, padding 2px 16px, font 14px/15px
  // Mobile styles: height 40px, padding 2px 16px, font 16px/17px
  const sizes = {
    sm: "h-9 px-4 py-0.5 text-sm leading-[15px]",
    md: "h-10 px-4 py-0.5 text-base leading-[17px] md:h-9 md:text-sm md:leading-[15px]",
    lg: "h-12 px-6 py-0.5 text-lg leading-[19px] md:h-10 md:text-base md:leading-[17px]",
  };

  const variants = {
    primary: disabled
      ? "bg-button-disabled-bg text-text-muted"
      : "bg-button-primary text-white hover:bg-button-hover active:bg-button-primary",
    secondary: disabled
      ? "bg-surface-secondary/50 text-text-muted"
      : "bg-surface-secondary text-foreground hover:bg-surface-tertiary",
    outline: disabled
      ? "border border-surface-tertiary/50 bg-transparent text-text-muted"
      : "border border-surface-tertiary bg-transparent hover:bg-surface-secondary",
    ghost: disabled
      ? "bg-transparent text-text-muted"
      : "bg-transparent hover:bg-surface-secondary",
  };

  // Filter out incompatible props: formAction (if function) and value (if not string)
  const heroButtonProps = {
    ...props,
    ...(typeof formAction === "string" ? { formAction } : {}),
    ...(typeof value === "string" ? { value } : {}),
  } as any;

  return (
    <HeroButton
      variant={variant as "solid" | "bordered" | "light" | "faded" | "shadow"}
      size={size}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        "tracking-[-0.02em]",
        className
      )}
      disabled={disabled}
      {...heroButtonProps}
    >
      {children}
    </HeroButton>
  );
}
