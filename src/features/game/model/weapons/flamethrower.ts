import { Projectile, Weapon, WeaponBehavior, WeaponType } from "../types";
import {
    buildBallisticAimPreview,
    createOffsetPreviewRays,
    createPreviewStyle,
    createBallisticProjectile,
    FLAMETHROWER_SPREAD_OFFSETS,
    DEFAULT_GRAVITY,
} from "./shared";

const FLAMETHROWER_SPEED_SCALE = 0.65;
const FLAMETHROWER_GRAVITY_SCALE = 0.45;

export const flamethrowerWeapon: Weapon = {
    type: WeaponType.FLAMETHROWER,
    name: "Flamethrower",
    damage: 40,
    blastRadius: 60,
    piercing: 2,
    fireDelay: 0.5,
    ammo: 1,
    maxAmmo: 1,
    projectileSpeed: 250,
    projectileSize: 3,
};

export const flamethrowerBehavior: WeaponBehavior = {
    spawnProjectiles: (input, weapon) => {
        const particleCount = FLAMETHROWER_SPREAD_OFFSETS.length;
        return FLAMETHROWER_SPREAD_OFFSETS.map((spreadAngle) => {
            const projectile = createBallisticProjectile(
                input,
                WeaponType.FLAMETHROWER,
                weapon,
                FLAMETHROWER_SPEED_SCALE,
                spreadAngle,
                Math.max(1.5, weapon.projectileSize)
            );

            return {
                ...projectile,
                damage: weapon.damage / particleCount,
                blastRadius: Math.max(2, weapon.blastRadius / 6),
                meta: { lifespan: 0.45 + Math.random() * 0.2, age: 0 },
            };
        });
    },
    stepProjectile: (projectile, dt) => {
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.vy += DEFAULT_GRAVITY * FLAMETHROWER_GRAVITY_SCALE * dt;

        const age = Number(projectile.meta?.age ?? 0) + dt;
        projectile.meta = {
            ...projectile.meta,
            age,
        };
    },
    drawProjectile: (ctx, projectile) => {
        const age = Number(projectile.meta?.age ?? 0);
        const lifespan = Number(projectile.meta?.lifespan ?? 0.5);
        const alpha = Math.max(0.2, 1 - age / lifespan);
        ctx.fillStyle = `rgba(251, 146, 60, ${alpha})`;
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        ctx.fill();
    },
    getAimPreview: (input) =>
        buildBallisticAimPreview(
            input,
            flamethrowerWeapon.projectileSpeed,
            createOffsetPreviewRays(FLAMETHROWER_SPREAD_OFFSETS, {
                speedScale: FLAMETHROWER_SPEED_SCALE,
                gravityScale: FLAMETHROWER_GRAVITY_SCALE,
            }),
            createPreviewStyle("rgba(251, 146, 60, 0.65)")
        ),
};

export function shouldExpireFlamethrowerProjectile(projectile: Projectile): boolean {
    const age = Number(projectile.meta?.age ?? 0);
    const lifespan = Number(projectile.meta?.lifespan ?? 0.5);
    return age >= lifespan;
}
