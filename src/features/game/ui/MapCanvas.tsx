"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { getWeaponBehavior, WEAPON_TYPES } from "../model/weapons";
import { Character } from "../model/types";
import { POWERUP_EFFECTS } from "../model/powerups";

const MAX_UPHILL_SLOPE_RATIO = 1.0;
const REACHABLE_SCAN_STEP = 1;

function findGroundTopAtX(
  terrain: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
  x: number,
): number {
  const clampedX = Math.max(0, Math.min(screenWidth - 1, Math.floor(x)));
  for (let y = 0; y < screenHeight; y++) {
    const idx = clampedX + y * screenWidth;
    if (terrain[idx] === 1) {
      return y;
    }
  }

  return screenHeight;
}

function getGroundTopForCharacterAtX(
  character: Character,
  characterX: number,
  terrain: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
): number {
  const sampleXs = [
    characterX + 2,
    characterX + character.width / 2,
    characterX + character.width - 2,
  ];

  let minGroundY = screenHeight;
  for (const sampleX of sampleXs) {
    const groundY = findGroundTopAtX(terrain, screenWidth, screenHeight, sampleX);
    if (groundY < minGroundY) {
      minGroundY = groundY;
    }
  }

  return minGroundY;
}

function isUphillStepReachable(
  character: Character,
  currentX: number,
  nextX: number,
  terrain: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
): boolean {
  const horizontalRun = Math.abs(nextX - currentX);
  if (horizontalRun <= 0) {
    return true;
  }

  const currentGroundTop = getGroundTopForCharacterAtX(character, currentX, terrain, screenWidth, screenHeight);
  const nextGroundTop = getGroundTopForCharacterAtX(character, nextX, terrain, screenWidth, screenHeight);
  const uphillRise = currentGroundTop - nextGroundTop;
  if (uphillRise <= 0) {
    return true;
  }

  return uphillRise / horizontalRun <= MAX_UPHILL_SLOPE_RATIO;
}

function scanReachableEdgeX(
  character: Character,
  originX: number,
  remainingWalkDistance: number,
  direction: -1 | 1,
  terrain: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
): number {
  const maxX = originX + direction * remainingWalkDistance;
  const clampedMaxX = Math.max(
    0,
    Math.min(maxX, screenWidth - character.width),
  );
  const maxDistance = Math.abs(clampedMaxX - originX);

  let farthestX = originX;

  for (let distance = REACHABLE_SCAN_STEP; distance <= maxDistance; distance += REACHABLE_SCAN_STEP) {
    const candidateX = originX + direction * distance;
    const clampedCandidateX = Math.max(
      0,
      Math.min(candidateX, screenWidth - character.width),
    );

    if (clampedCandidateX === farthestX) {
      break;
    }

    if (
      !isUphillStepReachable(character, originX, clampedCandidateX, terrain, screenWidth, screenHeight)
    ) {
      break;
    }

    farthestX = clampedCandidateX;
  }

  return farthestX;
}

function drawReachableTerrainHighlight(
  ctx: CanvasRenderingContext2D,
  character: Character,
  originX: number,
  maxWalkDistance: number,
  remainingWalkDistance: number,
  terrain: Uint8ClampedArray,
  screenWidth: number,
  screenHeight: number,
) {
  if (remainingWalkDistance <= 0) {
    return;
  }

  const remainingDistance = Math.max(0, Math.min(maxWalkDistance, remainingWalkDistance));

  const remainingLeftEdge = scanReachableEdgeX(
    character,
    originX,
    remainingDistance,
    -1,
    terrain,
    screenWidth,
    screenHeight,
  );
  const remainingRightEdge = scanReachableEdgeX(
    character,
    originX,
    remainingDistance,
    1,
    terrain,
    screenWidth,
    screenHeight,
  );

  const remainingStartX = Math.max(0, Math.floor(remainingLeftEdge));
  const remainingEndX = Math.min(screenWidth - 1, Math.ceil(remainingRightEdge + character.width));

  ctx.fillStyle = "rgba(74, 222, 128, 0.85)";
  for (let x = remainingStartX; x <= remainingEndX; x++) {
    const groundY = findGroundTopAtX(terrain, screenWidth, screenHeight, x);
    if (groundY >= screenHeight) {
      continue;
    }

    ctx.fillRect(x, Math.max(0, groundY - 2), 1, 2);
  }
}

export function MapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [hoveredPowerupId, setHoveredPowerupId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const { state, updateGame, playerInput, setInput } = useGameStore();

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state.screenWidth) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, state.screenWidth, state.screenHeight);

    // Draw sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, state.screenHeight);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#1e293b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.screenWidth, state.screenHeight);

    // Draw terrain
    const imageData = ctx.createImageData(state.screenWidth, state.screenHeight);
    const data = imageData.data;

    for (let i = 0; i < state.terrain.length; i++) {
      const idx = i * 4;
      if (state.terrain[i] === 1) {
        data[idx] = 139; // R
        data[idx + 1] = 107; // G
        data[idx + 2] = 20; // B
        data[idx + 3] = 255; // A
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const activeCharacter = [...state.players, ...state.bots].find(
      (character) => character.id === state.currentTurnEntityId,
    );
    const maxWalkDistanceForHighlight = state.maxWalkDistancePerTurn;
    const remainingWalkDistanceForHighlight = activeCharacter
      ? state.remainingWalkDistanceByEntityId[activeCharacter.id] ?? 0
      : 0;

    if (activeCharacter && !state.isGameOver) {
      drawReachableTerrainHighlight(
        ctx,
        activeCharacter,
        activeCharacter.x,
        maxWalkDistanceForHighlight,
        remainingWalkDistanceForHighlight,
        state.terrain,
        state.screenWidth,
        state.screenHeight,
      );
    }

    // Draw player
    const player = state.players[0];
    if (player) {
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(player.x, player.y, player.width, player.height);
      // Health bar
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(player.x, player.y - 10, player.width, 3);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(player.x, player.y - 10, (player.health / player.maxHealth) * player.width, 3);
    }

    // Draw bots
    for (const bot of state.bots) {
      ctx.fillStyle = "#f87171";
      ctx.fillRect(bot.x, bot.y, bot.width, bot.height);
      // Health bar
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(bot.x, bot.y - 10, bot.width, 3);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(bot.x, bot.y - 10, (bot.health / bot.maxHealth) * bot.width, 3);
    }

    // Draw projectiles
    for (const proj of state.projectiles) {
      const behavior = getWeaponBehavior(proj.weaponType);
      behavior.drawProjectile(ctx, proj);
    }

    // Draw explosions
    for (const exp of state.explosions) {
      const alpha = 1 - exp.age / exp.maxAge;
      ctx.fillStyle = `rgba(255, 165, 0, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw powerups
    for (const powerup of state.powerups) {
      const colorMap: Record<string, string> = {
        health: "#00ff00",
        armor: "#d4a574",
        pistol_ammo: "#ffff00",
        shotgun_ammo: "#ffff00",
        grenade_ammo: "#ffff00",
        bazooka_ammo: "#ffff00",
        flamethrower_ammo: "#ffff00",
        sniper_ammo: "#ffff00",
      };

      const color = colorMap[powerup.type] ?? "#ffffff";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI * 2);
      ctx.fill();

      // Add a border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw aiming line only on player turn
    const isPlayerTurn = state.currentTurnEntityId === player?.id;
    if (player && isPlayerTurn && playerInput.aim !== undefined) {
      const currentWeaponType = WEAPON_TYPES[state.currentWeaponIndex] ?? WEAPON_TYPES[0];
      const behavior = getWeaponBehavior(currentWeaponType);
      const preview = behavior.getAimPreview?.({
        originX: player.x + player.width / 2,
        originY: player.y + player.height / 2,
        aim: playerInput.aim,
        power: playerInput.power,
        terrain: state.terrain,
        screenWidth: state.screenWidth,
        screenHeight: state.screenHeight,
      });
      if (!preview) return;

      ctx.strokeStyle = preview.color;
      ctx.lineWidth = preview.lineWidth ?? 1.25;
      ctx.setLineDash(preview.lineDash ?? [4, 4]);

      for (const path of preview.paths) {
        if (path.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          const point = path[i];
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    // Draw turn info
    if (!state.isGameOver) {
      const turnLabel = state.currentTurnEntityId === player?.id ? "PLAYER TURN" : "BOT TURN";
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(12, 12, 180, 44);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "left";
      ctx.fillText(turnLabel, 20, 30);
      ctx.font = "12px Arial";
      ctx.fillText(`Time: ${Math.max(0, Math.ceil(state.turnTimeLeft))}s`, 20, 48);
    }

    // Draw game over screen
    if (state.isGameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, state.screenWidth, state.screenHeight);
      ctx.fillStyle = "white";
      ctx.font = "32px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Game Over!", state.screenWidth / 2, state.screenHeight / 2);
      ctx.font = "24px Arial";
      ctx.fillText(`${state.winner} Wins!`, state.screenWidth / 2, state.screenHeight / 2 + 40);
    }
  }, [state, playerInput]);

  // Game loop
  useEffect(() => {
    const gameLoop = () => {
      updateGame();
      render();
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [updateGame, render]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const player = state.players[0];
      const isPlayerTurn = state.currentTurnEntityId === player?.id;
      if (!isPlayerTurn || state.isGameOver) return;

      switch (e.key.toLowerCase()) {
        case "a":
        case "arrowleft":
          setInput({ moveLeft: true });
          break;
        case "d":
        case "arrowright":
          setInput({ moveRight: true });
          break;
        case "w":
          setInput({ changeWeapon: -1 });
          break;
        case "s":
          setInput({ changeWeapon: 1 });
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const player = state.players[0];
      const isPlayerTurn = state.currentTurnEntityId === player?.id;
      if (!isPlayerTurn || state.isGameOver) return;

      switch (e.key.toLowerCase()) {
        case "a":
        case "arrowleft":
          setInput({ moveLeft: false });
          break;
        case "d":
        case "arrowright":
          setInput({ moveRight: false });
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setInput, state.currentTurnEntityId, state.players, state.isGameOver]);

  // Mouse input for aiming and shooting
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      // CSS pixels relative to canvas element (for popup positioning)
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;

      // Scale to internal canvas coordinates (for game logic)
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = cssX * scaleX;
      const y = cssY * scaleY;

      // Track CSS-space mouse position for popup (relative to canvas container)
      setMousePos({ x: cssX, y: cssY });

      // Check if hovering over a powerup (using internal canvas coords)
      let hoveredPowerup: string | null = null;
      for (const powerup of state.powerups) {
        const dx = powerup.x - x;
        const dy = powerup.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < powerup.radius + 10) {
          hoveredPowerup = powerup.id;
          break;
        }
      }
      setHoveredPowerupId(hoveredPowerup);

      const player = state.players[0];
      const isPlayerTurn = state.currentTurnEntityId === player?.id;
      if (!isPlayerTurn || state.isGameOver) return;

      if (player) {
        const dx = x - (player.x + player.width / 2);
        const dy = y - (player.y + player.height / 2);
        const aim = Math.atan2(dy, dx);
        setInput({ aim });
      }
    };

    const handleMouseDown = () => {
      const player = state.players[0];
      const isPlayerTurn = state.currentTurnEntityId === player?.id;
      if (!isPlayerTurn || state.isGameOver) return;
      setInput({ shoot: true });
    };

    const handleMouseUp = () => {
      setInput({ shoot: false });
    };

    const handleMouseWheel = (e: WheelEvent) => {
      const player = state.players[0];
      const isPlayerTurn = state.currentTurnEntityId === player?.id;
      if (!isPlayerTurn || state.isGameOver) return;
      e.preventDefault();
      setInput({ power: Math.max(0, Math.min(1, playerInput.power - e.deltaY * 0.001)) });
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mousedown", handleMouseDown);
      canvas.addEventListener("mouseup", handleMouseUp);
      canvas.addEventListener("wheel", handleMouseWheel, { passive: false });
      canvas.addEventListener("mouseleave", () => setHoveredPowerupId(null));
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("wheel", handleMouseWheel);
        canvas.removeEventListener("mouseleave", () => setHoveredPowerupId(null));
      }
    };
  }, [state.players, state.currentTurnEntityId, state.isGameOver, playerInput, setInput, state.powerups]);

  const hoveredPowerup = hoveredPowerupId ? state.powerups.find(p => p.id === hoveredPowerupId) : null;
  const powerupEffect = hoveredPowerup ? POWERUP_EFFECTS[hoveredPowerup.type] : null;

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        width={state.screenWidth}
        height={state.screenHeight}
        className="h-full w-full rounded-lg border-2 border-slate-700 bg-slate-950"
      />
      {hoveredPowerup && powerupEffect && (
        <div
          className="pointer-events-none absolute z-50 rounded bg-slate-900 px-3 py-2 text-sm text-white shadow-lg border border-slate-600"
          style={{
            left: `${mousePos.x + 15}px`,
            top: `${mousePos.y + 15}px`,
          }}
        >
          <div className="font-semibold">{powerupEffect.name}</div>
          <div className="text-xs text-slate-300 mt-1">+{hoveredPowerup.value}</div>
        </div>
      )}
    </div>
  );
}
