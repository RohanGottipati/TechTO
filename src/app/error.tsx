"use client";

import { useEffect } from "react";
import { SceneErrorOverlay } from "@/components/feedback/SceneErrorOverlay";

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
    <div className="relative h-dvh w-screen overflow-hidden bg-twinto-ink">
      <SceneErrorOverlay
        title="Something went wrong"
        message="TwinTO hit an unexpected error. You can try reloading the page."
        onRetry={reset}
      />
    </div>
  );
}
