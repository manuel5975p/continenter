import { useEffect, useRef, useState } from "react";
import { ActionBar } from "./ui/ActionBar";
import { Hud } from "./ui/Hud";
import { MapCanvas } from "./ui/MapCanvas";
import { useGameStore } from "./store/useGameStore";

export function GameShell() {
  const initializeGame = useGameStore((s) => s.initializeGame);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log("[GameShell] useEffect fired");

    // Use the actual window/layout dimensions
    const sidebarWidth = window.innerWidth >= 1024 ? 320 : 0;
    const padding = 24; // p-3 = 12px on each side
    const gap = 12; // gap-3
    const actionBarHeight = 60;

    const screenWidth = window.innerWidth - sidebarWidth - padding - (sidebarWidth > 0 ? gap : 0);
    const screenHeight = window.innerHeight - padding - actionBarHeight;

    console.log("[GameShell] window:", window.innerWidth, "x", window.innerHeight);
    console.log("[GameShell] computed canvas:", screenWidth, "x", screenHeight);

    if (screenWidth > 0 && screenHeight > 0) {
      initializeGame(Math.floor(screenWidth), Math.floor(screenHeight));
      setReady(true);
      console.log("[GameShell] initializeGame called");
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
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white text-xl">
          Loading...
        </div>
      )}
    </main>
  );
}
