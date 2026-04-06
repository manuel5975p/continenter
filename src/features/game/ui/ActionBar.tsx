import { useGameStore } from "../store/useGameStore";
import { WEAPONS, WEAPON_TYPES } from "../model/weapons";
import { WeaponType } from "../model/types";
import {
  Crosshair,
  Zap,
  Bomb,
  Rocket,
  Flame,
  Target,
  RotateCcw,
  SkipForward,
} from "lucide-react";

const weaponIcons: Record<WeaponType, React.ReactNode> = {
  [WeaponType.PISTOL]: <Crosshair className="w-4 h-4" />,
  [WeaponType.SHOTGUN]: <Zap className="w-4 h-4" />,
  [WeaponType.GRENADE]: <Bomb className="w-4 h-4" />,
  [WeaponType.BAZOOKA]: <Rocket className="w-4 h-4" />,
  [WeaponType.FLAMETHROWER]: <Flame className="w-4 h-4" />,
  [WeaponType.SNIPER]: <Target className="w-4 h-4" />,
};

export function ActionBar() {
  const state = useGameStore((s) => s.state);
  const currentWeaponIndex = useGameStore((s) => s.state.currentWeaponIndex);
  const skipShot = useGameStore((s) => s.skipShot);

  const weaponTypes = WEAPON_TYPES;
  const currentWeaponType = weaponTypes[currentWeaponIndex] ?? weaponTypes[0];
  const currentWeapon = WEAPONS[currentWeaponType];
  const playerId = state.players[0]?.id;
  const currentAmmo = playerId
    ? state.ammoByEntityId[playerId]?.[currentWeaponType] ?? currentWeapon.maxAmmo
    : currentWeapon.maxAmmo;

  const isPlayerTurn = state.currentTurnEntityId === playerId;

  const handleRestart = () => {
    window.location.reload();
  };

  const handleSkipShot = () => {
    skipShot();
  };

  return (
    <div className="flex gap-4 items-center">
      {/* Current Weapon Info */}
      <div className="flex-1 flex items-center gap-4 px-4 py-2 bg-slate-800 rounded border border-slate-700">
        <div className="text-yellow-400">{weaponIcons[currentWeapon.type]}</div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{currentWeapon.name}</div>
          <div className="text-xs text-slate-400">Ammo: {currentAmmo}/{currentWeapon.maxAmmo}</div>
        </div>
      </div>

      {/* Skip Shot Button */}
      {isPlayerTurn && !state.isGameOver && !state.hasFiredThisTurn && (
        <button
          onClick={handleSkipShot}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-all cursor-pointer"
        >
          <SkipForward className="w-4 h-4" />
          <span>Skip Shot</span>
        </button>
      )}

      {/* Reset Button */}
      {state.isGameOver && (
        <button
          onClick={handleRestart}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Restart</span>
        </button>
      )}
    </div>
  );
}
