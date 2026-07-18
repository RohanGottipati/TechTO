import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GridControlRoom } from "@/components/grid/GridControlRoom";
import { getAsset } from "@/lib/grid/fixtures";

interface ControlRoomPageProps {
  params: { assetId: string };
}

export function generateMetadata({ params }: ControlRoomPageProps): Metadata {
  const asset = getAsset(params.assetId);
  return {
    title: asset
      ? `${asset.name} | GridTwin Control Room (Simulated)`
      : "GridTwin Control Room (Simulated)",
    description:
      "Decision-support demo for a simulated grid battery asset. Fixture data only; not a real control interface.",
  };
}

export default function ControlRoomPage({ params }: ControlRoomPageProps) {
  const asset = getAsset(params.assetId);
  if (!asset) {
    notFound();
  }

  return (
    <main className="h-dvh w-screen overflow-y-auto bg-[#070A0F]">
      <GridControlRoom assetId={params.assetId} />
    </main>
  );
}
