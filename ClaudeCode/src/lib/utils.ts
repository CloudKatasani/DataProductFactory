import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware class joiner. The one shadcn/ui expects to find here. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
