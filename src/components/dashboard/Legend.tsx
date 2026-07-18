"use client";

import {
  ACCEPT_NEUTRAL,
  ACCEPT_OPPOSE,
  ACCEPT_SUPPORT,
  BUS_COLOR,
} from "@/lib/map/palette";

export function Legend() {
  return (
    <div className="pointer-events-auto border border-hairline bg-panel px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[8.5px] uppercase text-muted">
          oppose
        </span>
        <span
          aria-hidden
          className="h-[6px] w-[92px] rounded-full"
          style={{
            background: `linear-gradient(90deg, ${ACCEPT_OPPOSE}, ${ACCEPT_NEUTRAL}, ${ACCEPT_SUPPORT})`,
          }}
        />
        <span className="font-mono text-[8.5px] uppercase text-muted">
          support
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[3px] w-[14px] rounded-full bg-[#e0cb3c]" />
          <span className="text-[9px] uppercase tracking-wider text-muted">
            subway
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[2px] w-[14px] rounded-full bg-[#7f6ff0]" />
          <span className="text-[9px] uppercase tracking-wider text-muted">
            streetcar
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-[2px] w-[14px] rounded-full"
            style={{ background: BUS_COLOR }}
          />
          <span className="text-[9px] uppercase tracking-wider text-muted">
            bus
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-[2px] w-[14px] rounded-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, #cfd8d0 0 4px, transparent 4px 7px)",
            }}
          />
          <span className="text-[9px] uppercase tracking-wider text-muted">
            proposed
          </span>
        </span>
      </div>
    </div>
  );
}
