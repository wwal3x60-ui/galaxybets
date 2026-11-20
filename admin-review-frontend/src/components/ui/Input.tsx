import { InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const generatedId=useId();
    const inputId=id || generatedId;
    return (
      <div className="flex flex-col gap-3">
        {label && (
          <label htmlFor={inputId} className="text-base font-medium leading-[17px] tracking-[-0.02em] text-white md:text-sm md:leading-[15px]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : props["aria-describedby"]}
          className={cn(
            "flex items-center px-3 py-0.5 rounded-md",
            "bg-background-sunken border border-border-subtle",
            "text-white placeholder:text-text-muted",
            "text-base font-medium leading-[17px] tracking-[-0.02em] md:text-sm md:leading-[15px]",
            "h-10 md:h-9",
            "focus:outline-none focus:ring-2 focus:ring-ancient-blue focus:border-transparent",
            "transition-colors",
            error && "border-error-base",
            className
          )}
          {...props}
        />
        {error && (
          <span id={`${inputId}-error`} role="alert" className="text-xs text-error-base">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
