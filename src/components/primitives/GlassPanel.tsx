"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function GlassPanel({
  children,
  className,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "border border-white/10 bg-[rgba(8,13,21,0.78)] backdrop-blur-xl",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
