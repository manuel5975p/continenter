import type { PowerUp } from "./powerups";

// Weapon types
export enum WeaponType {
    PISTOL = "pistol",
    SHOTGUN = "shotgun",
    GRENADE = "grenade",
    BAZOOKA = "bazooka",
    FLAMETHROWER = "flamethrower",
    SNIPER = "sniper",
}

export interface Weapon {
    type: WeaponType;
    name: string;
    damage: number;
    blastRadius: number;
    piercing?: number;
    fireDelay: number;
    ammo: number;
    maxAmmo: number;
    projectileSpeed: number;
    projectileSize: number;
}

export type WeaponAmmoByType = Record<WeaponType, number>;
export type AmmoByEntityId = Record<string, WeaponAmmoByType>;

// Character/Worm
export interface Character {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    health: number;
    maxHealth: number;
    velocity: { x: number; y: number };
    isJumping: boolean;
    isBot: boolean;
}

// Projectile
export interface Projectile {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    weaponType: WeaponType;
    damage: number;
    blastRadius: number;
    remainingPierces?: number;
    ownerId: string;
    meta?: Record<string, number | string | boolean>;
}

export type ProjectileBlueprint = Omit<Projectile, "id" | "ownerId">;

export interface WeaponFireInput {
    owner: Character;
    aim: number;
    power: number;
}

export interface WeaponPreviewRay {
    speedScale: number;
    gravityScale: number;
    spreadRadians: number;
}

export interface WeaponAimPreviewInput {
    originX: number;
    originY: number;
    aim: number;
    power: number;
    terrain: Uint8ClampedArray;
    screenWidth: number;
    screenHeight: number;
}

export interface WeaponAimPreviewPathPoint {
    x: number;
    y: number;
}

export interface WeaponAimPreview {
    paths: WeaponAimPreviewPathPoint[][];
    color: string;
    lineWidth?: number;
    lineDash?: number[];
}

export interface WeaponBehavior {
    spawnProjectiles: (input: WeaponFireInput, weapon: Weapon) => ProjectileBlueprint[];
    stepProjectile?: (projectile: Projectile, dt: number) => void;
    drawProjectile: (ctx: CanvasRenderingContext2D, projectile: Projectile) => void;
    getAimPreview?: (input: WeaponAimPreviewInput) => WeaponAimPreview;
}

// Explosion effect
export interface Explosion {
    x: number;
    y: number;
    radius: number;
    age: number;
    maxAge: number;
}

// Game State
export interface GameState {
    players: Character[];
    bots: Character[];
    projectiles: Projectile[];
    powerups: PowerUp[];
    explosions: Explosion[];
    terrain: Uint8ClampedArray;
    screenWidth: number;
    screenHeight: number;
    currentPlayerIndex: number;
    currentWeaponIndex: number;
    gameTime: number;
    turnOrder: string[];
    currentTurnIndex: number;
    currentTurnEntityId: string;
    turnTimeLeft: number;
    hasFiredThisTurn: boolean;
    ammoByEntityId: AmmoByEntityId;
    armorByEntityId: Record<string, number>;
    maxWalkDistancePerTurn: number;
    remainingWalkDistanceByEntityId: Record<string, number>;
    walkRangeOriginXByEntityId: Record<string, number>;
    isGameOver: boolean;
    winner?: string;
}

// Input state
export interface GameInput {
    moveLeft: boolean;
    moveRight: boolean;
    aim: number; // angle in radians
    power: number; // 0-1
    shoot: boolean;
    changeWeapon: number; // -1, 0, or 1
}
