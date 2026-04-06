import type { GameState, Character } from "../types";

export enum PowerUpType {
    HEALTH = "health",
    ARMOR = "armor",
    PISTOL_AMMO = "pistol_ammo",
    SHOTGUN_AMMO = "shotgun_ammo",
    GRENADE_AMMO = "grenade_ammo",
    BAZOOKA_AMMO = "bazooka_ammo",
    FLAMETHROWER_AMMO = "flamethrower_ammo",
    SNIPER_AMMO = "sniper_ammo",
}

export interface PowerUp {
    id: string;
    type: PowerUpType;
    x: number;
    y: number;
    radius: number;
    velocity: { x: number; y: number };
    value: number;
}

export interface PowerUpEffect {
    type: PowerUpType;
    onPickup: (character: Character, state: GameState, value: number) => Partial<Character>;
    value: number;
    color: string;
    name: string;
}
