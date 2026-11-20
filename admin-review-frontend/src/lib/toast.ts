import { addToast as herouiAddToast } from "@heroui/react";
import clsx from "clsx";
import { playAlertSuccess, playSoundEffectError } from "@/lib/audio";
import styles from "./toast.module.css";
type ToastOptions = Parameters<typeof herouiAddToast>[0];
export function addToast(options: ToastOptions): string | null {
  const color=options?.color??options?.severity;
  if(color==='success')playAlertSuccess();else if(color==='danger')playSoundEffectError();
  if(color!=='success')return herouiAddToast(options);
  return herouiAddToast({...options,timeout:options.timeout??2200,classNames:{...options.classNames,base:clsx(options.classNames?.base,styles.compact)}});
}
