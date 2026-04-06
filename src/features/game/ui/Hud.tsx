"use client";

import { useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { WEAPONS, WEAPON_TYPES } from "../model/weapons";
import {
  Crosshair,
  Zap,
  Bomb,
  Rocket,
  Flame,
  Target,
} from "lucide-react";
import { WeaponType } from "../model/types";

const weaponIcons: Record<WeaponType, React.ReactNode> = {
  [WeaponType.PISTOL]: <Crosshair className="w-6 h-6" />,
  [WeaponType.SHOTGUN]: <Zap className="w-6 h-6" />,
  [WeaponType.GRENADE]: <Bomb className="w-6 h-6" />,
  [WeaponType.BAZOOKA]: <Rocket className="w-6 h-6" />,
  [WeaponType.FLAMETHROWER]: <Flame className="w-6 h-6" />,
  [WeaponType.SNIPER]: <Target className="w-6 h-6" />,
};

const speedOptions = [1, 2.5, 5] as const;

export function Hud() {
  const state = useGameStore((s) => s.state);
  const currentWeaponIndex = useGameStore((s) => s.state.currentWeaponIndex);
  const playerInput = useGameStore((s) => s.playerInput);
  const gameSpeed = useGameStore((s) => s.gameSpeed);
  const setGameSpeed = useGameStore((s) => s.setGameSpeed);
  const selectWeapon = useGameStore((s) => s.selectWeapon);
  const [isWeaponMenuOpen, setWeaponMenuOpen] = useState(false);

  const player = state.players[0];
  const playerAmmo = player ? state.ammoByEntityId[player.id] : undefined;
  const currentWeaponType = WEAPON_TYPES[currentWeaponIndex] ?? WEAPON_TYPES[0];
  const currentWeapon = WEAPONS[currentWeaponType];
  const currentWeaponAmmo = playerAmmo?.[currentWeaponType] ?? currentWeapon.maxAmmo;
  const isPlayerTurn = state.currentTurnEntityId === player?.id;
  const currentTurnLabel = isPlayerTurn
    ? "Player"
    : `Bot ${Math.max(1, state.bots.findIndex((bot) => bot.id === state.currentTurnEntityId) + 1)}`;

  return (
    <>
    <div className="flex flex-col gap-4 rounded-lg border-2 border-slate-700 bg-slate-900 p-4 h-full min-h-0">
      {/* Player Stats */}
      {player && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">TURN</h3>
            <div className="bg-slate-800 rounded p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Active</span>
                <span className={isPlayerTurn ? "text-blue-300" : "text-rose-300"}>{currentTurnLabel}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-400">Time left</span>
                <span>{Math.max(0, Math.ceil(state.turnTimeLeft))}s</span>
              </div>

              <div className="mt-3 border-t border-slate-700 pt-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Bot speed</span>
                  <span>{gameSpeed.toFixed(1)}x</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {speedOptions.map((speed) => {
                    const isSelected = gameSpeed === speed;
                    return (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setGameSpeed(speed)}
                        className={`rounded px-2 py-1 text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        }`}
                      >
                        {speed}x
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">PLAYER</h3>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Health</span>
                  <span>{Math.round(player.health)}/{player.maxHealth}</span>
                </div>
                <div className="w-full bg-slate-700 rounded h-4">
                  <div
                    className="bg-green-500 h-4 rounded transition-all"
                    style={{ width: `${(player.health / player.maxHealth) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Current Weapon */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">CURRENT WEAPON</h3>
            <div className="bg-slate-800 rounded p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-blue-400">{weaponIcons[currentWeapon.type]}</div>
                <div>
                  <div className="font-semibold text-sm">{currentWeapon.name}</div>
                  <div className="text-xs text-slate-400">
                    Ammo: {currentWeaponAmmo} / {currentWeapon.maxAmmo}
                  </div>
                </div>
              </div>
              <div className="text-xs space-y-1 text-slate-400">
                <div>Damage: {currentWeapon.damage}</div>
                <div>Speed: {currentWeapon.projectileSpeed}</div>
                <div>Blast: {currentWeapon.blastRadius}</div>
              </div>
              <button
                type="button"
                onClick={() => setWeaponMenuOpen(true)}
                className="w-full rounded bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-600 cursor-pointer"
              >
                Select Weapon
              </button>
            </div>
          </div>

          {/* Shooting Power */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Power</span>
              <span>{Math.round(playerInput.power * 100)}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded h-3">
              <div
                className="bg-yellow-500 h-3 rounded transition-all"
                style={{ width: `${playerInput.power * 100}%` }}
              />
            </div>
          </div>

          {/* Aiming Angle */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Angle</span>
              <span>{Math.round((playerInput.aim * 180) / Math.PI)}°</span>
            </div>
          </div>

        </div>
      )}

      {/* Bots Stats */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">ENEMIES</h3>
        <div className="space-y-2 overflow-y-auto flex-1">
          {state.bots.map((bot, idx) => (
            <div key={bot.id} className="bg-slate-800 rounded p-2 text-xs">
              <div className="flex justify-between mb-1">
                <span>Bot {idx + 1}</span>
                <span className={bot.health > 0 ? "text-green-400" : "text-red-400"}>
                  {Math.round(bot.health)}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded h-2">
                <div
                  className="bg-red-500 h-2 rounded transition-all"
                  style={{ width: `${Math.max(0, (bot.health / bot.maxHealth) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls Info */}
      <div className="mt-auto pt-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 space-y-1">
          <div><span className="text-slate-300">A/D:</span> Move</div>
          <div><span className="text-slate-300">Mouse:</span> Aim</div>
          <div><span className="text-slate-300">Click:</span> Shoot</div>
          <div><span className="text-slate-300">Scroll:</span> Power</div>
          <div><span className="text-slate-300">W/S:</span> Weapon</div>
        </div>
      </div>
    </div>

    {isWeaponMenuOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-lg border-2 border-slate-700 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Select Weapon</h3>
            <button
              type="button"
              onClick={() => setWeaponMenuOpen(false)}
              className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600 cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            {WEAPON_TYPES.map((weaponType, idx) => {
              const weapon = WEAPONS[weaponType];
              const weaponAmmo = playerAmmo?.[weaponType] ?? weapon.maxAmmo;
              const isSelected = idx === currentWeaponIndex;

              return (
                <button
                  key={weaponType}
                  type="button"
                  onClick={() => {
                    selectWeapon(idx);
                    setWeaponMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-blue-400 bg-blue-600/20 text-white"
                      : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-blue-300">{weaponIcons[weaponType]}</div>
                    <div>
                      <div className="text-sm font-semibold">{weapon.name}</div>
                      <div className="text-xs text-slate-400">Damage: {weapon.damage}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {weaponAmmo}/{weapon.maxAmmo}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
