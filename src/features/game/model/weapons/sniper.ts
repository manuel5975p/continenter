import { Weapon, WeaponBehavior, WeaponType } from "../types";
import {
    buildBallisticAimPreview,
    createSinglePreviewRay,
    createPreviewStyle,
    createBallisticProjectile,
    defaultStepProjectile,
    drawCircle,
} from "./shared";

export const SNIPER_SPEED_SCALE = 1.2;

export const sniperWeapon: Weapon = {
    type: WeaponType.SNIPER,
    name: "Sniper Rifle",
    damage: 50,
    blastRadius: 0,
    piercing: 1,
    fireDelay: 2.5,
    ammo: 1,
    maxAmmo: 1,
    projectileSpeed: 600,
    projectileSize: 2,
};

export const sniperBehavior: WeaponBehavior = {
    spawnProjectiles: (input, weapon) => [createBallisticProjectile(input, WeaponType.SNIPER, weapon, SNIPER_SPEED_SCALE)],
    stepProjectile: defaultStepProjectile,
    drawProjectile: (ctx, projectile) => drawCircle(ctx, projectile, "#e2e8f0"),
    getAimPreview: (input) =>
        buildBallisticAimPreview(
            input,
            sniperWeapon.projectileSpeed,
            [createSinglePreviewRay({ speedScale: SNIPER_SPEED_SCALE })],
            createPreviewStyle("rgba(226, 232, 240, 0.85)", {
                lineWidth: 1.5,
                lineDash: [6, 4],
            })
        ),
};
