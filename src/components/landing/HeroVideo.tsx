"use client";

import { useRef } from "react";

const REPLAY_DELAY_MS = 5000;

/** Plays the hero clip once, then holds on the last frame for a beat before replaying. */
export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      src="/video/toronto-hero.mp4"
      autoPlay
      muted
      playsInline
      preload="auto"
      onEnded={() => {
        const video = videoRef.current;
        if (!video) return;
        window.setTimeout(() => {
          video.currentTime = 0;
          void video.play();
        }, REPLAY_DELAY_MS);
      }}
    />
  );
}
