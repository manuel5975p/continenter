import { Projectile, Weapon, WeaponBehavior, WeaponType } from "./types";
import { bazookaBehavior, bazookaWeapon } from "./weapons/bazooka";
import {
    flamethrowerBehavior,
    flamethrowerWeapon,
    shouldExpireFlamethrowerProjectile,
} from "./weapons/flamethrower";
import { grenadeBehavior, grenadeWeapon } from "./weapons/grenade";
import { pistolBehavior, pistolWeapon } from "./weapons/pistol";
import { defaultStepProjectile } from "./weapons/shared";
import { shotgunBehavior, shotgunWeapon } from "./weapons/shotgun";
import { SNIPER_SPEED_SCALE, sniperBehavior, sniperWeapon } from "./weapons/sniper";

export { SNIPER_SPEED_SCALE };

export const WEAPON_TYPES: WeaponType[] = [
    WeaponType.PISTOL,
    WeaponType.SHOTGUN,
    WeaponType.GRENADE,
    WeaponType.BAZOOKA,
    WeaponType.FLAMETHROWER,
    WeaponType.SNIPER,
];

export const WEAPONS: Record<WeaponType, Weapon> = {
    [WeaponType.PISTOL]: pistolWeapon,
    [WeaponType.SHOTGUN]: shotgunWeapon,
    [WeaponType.GRENADE]: grenadeWeapon,
    [WeaponType.BAZOOKA]: bazookaWeapon,
    [WeaponType.FLAMETHROWER]: flamethrowerWeapon,
    [WeaponType.SNIPER]: sniperWeapon,
};

const WEAPON_BEHAVIORS: Record<WeaponType, WeaponBehavior> = {
    [WeaponType.PISTOL]: pistolBehavior,
    [WeaponType.SHOTGUN]: shotgunBehavior,
    [WeaponType.GRENADE]: grenadeBehavior,
    [WeaponType.BAZOOKA]: bazookaBehavior,
    [WeaponType.FLAMETHROWER]: flamethrowerBehavior,
    [WeaponType.SNIPER]: sniperBehavior,
};

export function getWeapon(type: WeaponType): Weapon {
    return { ...WEAPONS[type] };
}

export function getWeaponList(): Weapon[] {
    return WEAPON_TYPES.map((type) => WEAPONS[type]);
}

export function getWeaponBehavior(type: WeaponType): WeaponBehavior {
    return WEAPON_BEHAVIORS[type];
}

export function stepProjectileWithWeapon(projectile: Projectile, dt: number) {
    const behavior = getWeaponBehavior(projectile.weaponType);
    if (behavior.stepProjectile) {
        behavior.stepProjectile(projectile, dt);
        return;
    }

    defaultStepProjectile(projectile, dt);
}

export function shouldExpireProjectile(projectile: Projectile): boolean {
    if (projectile.weaponType !== WeaponType.FLAMETHROWER) {
        return false;
    }

    return shouldExpireFlamethrowerProjectile(projectile);
}
