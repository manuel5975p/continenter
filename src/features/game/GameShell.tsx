"use client";

import { useEffect, useRef } from "react";
import { ActionBar } from "./ui/ActionBar";
import { Hud } from "./ui/Hud";
import { MapCanvas } from "./ui/MapCanvas";
import { useGameStore } from "./store/useGameStore";

export function GameShell() {
  const initializeGame = useGameStore((s) => s.initializeGame);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const container = document.querySelector("main");
    if (container) {
      const mapArea = container.querySelector('[class*="lg:grid-cols"]');
      if (mapArea) {
        const screenWidth = mapArea.clientWidth;
        const screenHeight = mapArea.clientHeight;
        initializeGame(screenWidth, screenHeight);
      }
    }
  }, [initializeGame]);

  return (
    <main className="flex h-screen w-full flex-col bg-slate-950 text-white">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[320px_1fr]">
        <Hud />
        <MapCanvas />
      </div>
      <div className="px-3 pb-3">
        <ActionBar />
      </div>
    </main>
  );
}
