"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-dvh w-screen items-center justify-center overflow-hidden bg-ink">
      <div className="max-w-sm border border-hairline bg-panel px-6 py-5 text-center">
        <div className="text-[13px] font-semibold text-ink-bright">
          Something went wrong
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-muted">
          The dashboard hit an unexpected error.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 border border-hairline px-4 py-1.5 text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:bg-white/[0.06]"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
