import { Weapon, WeaponBehavior, WeaponType } from "../types";
import {
    buildBallisticAimPreview,
    createSinglePreviewRay,
    createPreviewStyle,
    createBallisticProjectile,
    DEFAULT_GRAVITY,
    drawCircle,
} from "./shared";

export const grenadeWeapon: Weapon = {
    type: WeaponType.GRENADE,
    name: "Grenade",
    damage: 60,
    blastRadius: 80,
    fireDelay: 1.5,
    ammo: 3,
    maxAmmo: 3,
    projectileSpeed: 350,
    projectileSize: 6,
};

export const grenadeBehavior: WeaponBehavior = {
    spawnProjectiles: (input, weapon) => [createBallisticProjectile(input, WeaponType.GRENADE, weapon, 0.8)],
    stepProjectile: (projectile, dt) => {
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.vy += DEFAULT_GRAVITY * 1.3 * dt;
    },
    drawProjectile: (ctx, projectile) => drawCircle(ctx, projectile, "#a3e635"),
    getAimPreview: (input) =>
        buildBallisticAimPreview(
            input,
            grenadeWeapon.projectileSpeed,
            [createSinglePreviewRay({ speedScale: 0.8, gravityScale: 1.3 })],
            createPreviewStyle("rgba(163, 230, 53, 0.75)")
        ),
};
