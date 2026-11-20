import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, className, checked, onChange, disabled, ...props }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="sr-only"
            {...props}
          />
          {/* Custom Switch Visual */}
          <div
            className={cn(
              "relative w-[60px] h-8 rounded-full transition-all cursor-pointer",
              "border",
              checked
                ? "bg-button-primary border-checkbox-checked-border"
                : "bg-background-sunken border-border-subtle",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => {
              if (!disabled && onChange) {
                const syntheticEvent = {
                  target: { checked: !checked },
                } as React.ChangeEvent<HTMLInputElement>;
                onChange(syntheticEvent);
              }
            }}
          >
            {/* Toggle Circle */}
            <div
              className={cn(
                "absolute top-0.5 w-7 h-7 rounded-full transition-all duration-200",
                checked
                  ? "bg-white right-0.5"
                  : "bg-text-muted left-0.5"
              )}
            />
          </div>
        </div>
        {label && (
          <label className="text-sm font-medium leading-[15px] tracking-[-0.02em] text-white cursor-pointer md:text-xs md:leading-[130%]">
            {label}
          </label>
        )}
      </div>
    );
  }
);

Switch.displayName = "Switch";
