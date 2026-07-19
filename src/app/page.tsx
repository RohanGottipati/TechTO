import Link from "next/link";
import { HeroVideo } from "@/components/landing/HeroVideo";

export default function LandingPage() {
  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-ink">
      <HeroVideo />

      {/* Darken + ground the footage so the UI stays legible over any frame. */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/35 to-ink/85" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />

      <div className="relative flex h-full w-full flex-col justify-between px-6 py-8 sm:px-14 sm:py-10">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-oppose" aria-hidden="true" />
          <span className="font-ui text-sm font-semibold tracking-wide text-ink-bright">
            TechTO
          </span>
        </div>

        <div className="flex flex-1 items-end pb-6 sm:pb-10">
          <div className="flex max-w-xl flex-col gap-6">
            <h1 className="font-ui text-4xl font-normal leading-[1.1] text-ink-bright sm:text-6xl">
              The Toronto twin,
              <br /> mapped and simulated.
            </h1>

            <div className="flex flex-col gap-5">
              <p className="max-w-md font-ui text-sm leading-relaxed text-muted sm:text-[15px]">
                TechTO builds the planning twin for Toronto. From neighbourhood
                zoning to transit and resident sentiment, every signal flows
                through one interactive city model.
              </p>

              <Link
                href="/city"
                className="group inline-flex w-fit items-center gap-2 bg-support px-6 py-3 font-ui text-sm font-medium uppercase tracking-wide text-ink transition-colors hover:bg-support/85"
              >
                Enter the twin
                <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="flex w-48 flex-col gap-2 border-t border-white/25 pt-2 text-right">
            <span className="font-ui text-xs text-ink-bright">Live data. Every neighbourhood.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
