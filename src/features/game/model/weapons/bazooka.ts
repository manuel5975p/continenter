import { Weapon, WeaponBehavior, WeaponType } from "../types";
import {
    buildBallisticAimPreview,
    createSinglePreviewRay,
    createPreviewStyle,
    createBallisticProjectile,
    defaultStepProjectile,
    drawCircle,
} from "./shared";

export const bazookaWeapon: Weapon = {
    type: WeaponType.BAZOOKA,
    name: "Bazooka",
    damage: 80,
    blastRadius: 120,
    fireDelay: 2,
    ammo: 2,
    maxAmmo: 2,
    projectileSpeed: 450,
    projectileSize: 10,
};

export const bazookaBehavior: WeaponBehavior = {
    spawnProjectiles: (input, weapon) => [createBallisticProjectile(input, WeaponType.BAZOOKA, weapon)],
    stepProjectile: defaultStepProjectile,
    drawProjectile: (ctx, projectile) => {
        drawCircle(ctx, projectile, "#f97316");
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(projectile.x, projectile.y);
        ctx.lineTo(projectile.x - projectile.vx * 0.02, projectile.y - projectile.vy * 0.02);
        ctx.stroke();
    },
    getAimPreview: (input) =>
        buildBallisticAimPreview(
            input,
            bazookaWeapon.projectileSpeed,
            [createSinglePreviewRay()],
            createPreviewStyle("rgba(249, 115, 22, 0.75)")
        ),
};
