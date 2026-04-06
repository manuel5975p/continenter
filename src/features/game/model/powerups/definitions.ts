import type { Character, WeaponType } from "../types";
import { WeaponType as WeaponTypeEnum } from "../types";
import { PowerUpType, type PowerUpEffect } from "./types";

const HEALTH_PICKUP = {
    type: PowerUpType.HEALTH,
    value: 30,
    color: "#00ff00",
    name: "Health +30",
    onPickup: (character: Character): Partial<Character> => {
        return {
            health: Math.min(character.health + 30, character.maxHealth),
        };
    },
} as PowerUpEffect;

const ARMOR_PICKUP = {
    type: PowerUpType.ARMOR,
    value: 25,
    color: "#d4a574",
    name: "Armor +25",
    onPickup: (): Partial<Character> => {
        // Armor is tracked separately in store, not on character
        return {};
    },
} as PowerUpEffect;

const createAmmoPickup = (weaponType: WeaponType, powerUpType: PowerUpType): PowerUpEffect => ({
    type: powerUpType,
    value: 1,
    color: "#ffff00",
    name: `${weaponType} Ammo +1`,
    onPickup: (): Partial<Character> => {
        // Ammo is tracked separately in store, not on character
        return {};
    },
});

export const POWERUP_EFFECTS: Record<PowerUpType, PowerUpEffect> = {
    [PowerUpType.HEALTH]: HEALTH_PICKUP,
    [PowerUpType.ARMOR]: ARMOR_PICKUP,
    [PowerUpType.PISTOL_AMMO]: createAmmoPickup(
        WeaponTypeEnum.PISTOL,
        PowerUpType.PISTOL_AMMO
    ),
    [PowerUpType.SHOTGUN_AMMO]: createAmmoPickup(
        WeaponTypeEnum.SHOTGUN,
        PowerUpType.SHOTGUN_AMMO
    ),
    [PowerUpType.GRENADE_AMMO]: createAmmoPickup(
        WeaponTypeEnum.GRENADE,
        PowerUpType.GRENADE_AMMO
    ),
    [PowerUpType.BAZOOKA_AMMO]: createAmmoPickup(
        WeaponTypeEnum.BAZOOKA,
        PowerUpType.BAZOOKA_AMMO
    ),
    [PowerUpType.FLAMETHROWER_AMMO]: createAmmoPickup(
        WeaponTypeEnum.FLAMETHROWER,
        PowerUpType.FLAMETHROWER_AMMO
    ),
    [PowerUpType.SNIPER_AMMO]: createAmmoPickup(
        WeaponTypeEnum.SNIPER,
        PowerUpType.SNIPER_AMMO
    ),
};

export const POWERUP_TYPES_WITH_WEIGHTS = [
    { type: PowerUpType.HEALTH, weight: 3 },
    { type: PowerUpType.ARMOR, weight: 2 },
    { type: PowerUpType.PISTOL_AMMO, weight: 1 },
    { type: PowerUpType.SHOTGUN_AMMO, weight: 1 },
    { type: PowerUpType.GRENADE_AMMO, weight: 1 },
    { type: PowerUpType.BAZOOKA_AMMO, weight: 1 },
    { type: PowerUpType.FLAMETHROWER_AMMO, weight: 1 },
    { type: PowerUpType.SNIPER_AMMO, weight: 1 },
];

// Utility function to get random powerup type based on weights
export function getRandomPowerUpType(): PowerUpType {
    const totalWeight = POWERUP_TYPES_WITH_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    for (const item of POWERUP_TYPES_WITH_WEIGHTS) {
        random -= item.weight;
        if (random <= 0) {
            return item.type;
        }
    }
    return PowerUpType.HEALTH;
}
