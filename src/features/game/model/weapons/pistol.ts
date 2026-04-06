import { Weapon, WeaponBehavior, WeaponType } from "../types";
import {
    buildBallisticAimPreview,
    createSinglePreviewRay,
    createPreviewStyle,
    createBallisticProjectile,
    defaultStepProjectile,
    drawCircle,
} from "./shared";

export const pistolWeapon: Weapon = {
    type: WeaponType.PISTOL,
    name: "Pistol",
    damage: 10,
    blastRadius: 1,
    fireDelay: 0.3,
    ammo: 6,
    maxAmmo: 6,
    projectileSpeed: 400,
    projectileSize: 4,
};

export const pistolBehavior: WeaponBehavior = {
    spawnProjectiles: (input, weapon) => [createBallisticProjectile(input, WeaponType.PISTOL, weapon)],
    stepProjectile: defaultStepProjectile,
    drawProjectile: (ctx, projectile) => drawCircle(ctx, projectile, "#fbbf24"),
    getAimPreview: (input) =>
        buildBallisticAimPreview(
            input,
            pistolWeapon.projectileSpeed,
            [createSinglePreviewRay()],
            createPreviewStyle("rgba(251, 191, 36, 0.7)")
        ),
};
