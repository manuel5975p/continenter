import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameShell } from "./features/game/GameShell";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameShell />
  </StrictMode>
);
