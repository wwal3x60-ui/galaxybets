import { InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> { label?: string }
export const Checkbox=forwardRef<HTMLInputElement,CheckboxProps>(({label,className,id,...props},ref)=>{
 const generatedId=useId(),inputId=id||generatedId;
 return <label htmlFor={inputId} className={cn("flex cursor-pointer items-start gap-2",props.disabled&&"cursor-not-allowed opacity-50")}><input ref={ref} id={inputId} type="checkbox" className={cn("mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300",className)} {...props}/>{label&&<span className="text-sm leading-relaxed text-white md:text-xs">{label}</span>}</label>;
});
Checkbox.displayName="Checkbox";
