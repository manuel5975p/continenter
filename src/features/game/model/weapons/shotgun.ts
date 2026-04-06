import { Weapon, WeaponBehavior, WeaponType } from "../types";
import {
    buildBallisticAimPreview,
    createEvenSpreadAngles,
    createOffsetPreviewRays,
    createPreviewStyle,
    createBallisticProjectile,
    defaultStepProjectile,
    drawCircle,
} from "./shared";

const SHOTGUN_PELLET_COUNT = 6;
const SHOTGUN_SPREAD_RADIANS = 0.22;
const SHOTGUN_SPEED_SCALE = 0.95;
const SHOTGUN_SPREAD_ANGLES = createEvenSpreadAngles({
    count: SHOTGUN_PELLET_COUNT,
    totalSpreadRadians: SHOTGUN_SPREAD_RADIANS,
});

export const shotgunWeapon: Weapon = {
    type: WeaponType.SHOTGUN,
    name: "Shotgun",
    damage: 50,
    blastRadius: 5,
    fireDelay: 1,
    ammo: 4,
    maxAmmo: 4,
    projectileSpeed: 350,
    projectileSize: 8,
};

export const shotgunBehavior: WeaponBehavior = {
    spawnProjectiles: (input, weapon) => {
        return SHOTGUN_SPREAD_ANGLES.map((spreadAngle) => {
            return createBallisticProjectile(
                input,
                WeaponType.SHOTGUN,
                weapon,
                SHOTGUN_SPEED_SCALE,
                spreadAngle,
                Math.max(2, weapon.projectileSize * 0.5)
            );
        }).map((projectile) => ({
            ...projectile,
            damage: weapon.damage / SHOTGUN_PELLET_COUNT,
            blastRadius: Math.max(1, weapon.blastRadius * 0.25),
        }));
    },
    stepProjectile: defaultStepProjectile,
    drawProjectile: (ctx, projectile) => drawCircle(ctx, projectile, "#fde68a"),
    getAimPreview: (input) =>
        buildBallisticAimPreview(
            input,
            shotgunWeapon.projectileSpeed,
            createOffsetPreviewRays(SHOTGUN_SPREAD_ANGLES, {
                speedScale: SHOTGUN_SPEED_SCALE,
                gravityScale: 1,
            }),
            createPreviewStyle("rgba(253, 230, 138, 0.6)")
        ),
};
