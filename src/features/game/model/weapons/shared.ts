import {
    Projectile,
    ProjectileBlueprint,
    Weapon,
    WeaponAimPreview,
    WeaponAimPreviewInput,
    WeaponFireInput,
    WeaponPreviewRay,
    WeaponType,
} from "../types";

export const DEFAULT_GRAVITY = 600;
export const DEFAULT_PREVIEW_LINE_WIDTH = 1.25;
export const DEFAULT_PREVIEW_LINE_DASH: number[] = [4, 4];
export const DEFAULT_PREVIEW_RAY: WeaponPreviewRay = {
    speedScale: 1,
    gravityScale: 1,
    spreadRadians: 0,
};

export const clampPower = (power: number) => Math.max(0.1, Math.min(1, power));

export function createPreviewStyle(
    color: string,
    options?: { lineWidth?: number; lineDash?: number[] }
): Pick<WeaponAimPreview, "color" | "lineWidth" | "lineDash"> {
    return {
        color,
        lineWidth: options?.lineWidth ?? DEFAULT_PREVIEW_LINE_WIDTH,
        lineDash: [...(options?.lineDash ?? DEFAULT_PREVIEW_LINE_DASH)],
    };
}

export function createSinglePreviewRay(
    options?: Partial<Pick<WeaponPreviewRay, "speedScale" | "gravityScale" | "spreadRadians">>
): WeaponPreviewRay {
    return {
        speedScale: options?.speedScale ?? DEFAULT_PREVIEW_RAY.speedScale,
        gravityScale: options?.gravityScale ?? DEFAULT_PREVIEW_RAY.gravityScale,
        spreadRadians: options?.spreadRadians ?? DEFAULT_PREVIEW_RAY.spreadRadians,
    };
}

export function createEvenSpreadAngles(options: {
    count: number;
    totalSpreadRadians: number;
}): number[] {
    const count = Math.max(1, Math.floor(options.count));
    return Array.from({ length: count }, (_, idx) => {
        const t = count === 1 ? 0 : idx / (count - 1);
        return (t - 0.5) * options.totalSpreadRadians;
    });
}

export const FLAMETHROWER_SPREAD_OFFSETS: number[] = createEvenSpreadAngles({
    count: 10,
    totalSpreadRadians: 0.34,
});

export function createEvenSpreadPreviewRays(options: {
    count: number;
    totalSpreadRadians: number;
    speedScale?: number;
    gravityScale?: number;
}): WeaponPreviewRay[] {
    return createOffsetPreviewRays(createEvenSpreadAngles(options), {
        speedScale: options.speedScale,
        gravityScale: options.gravityScale,
    });
}

export function createOffsetPreviewRays(
    spreadOffsets: number[],
    options?: Partial<Pick<WeaponPreviewRay, "speedScale" | "gravityScale">>
): WeaponPreviewRay[] {
    const speedScale = options?.speedScale ?? DEFAULT_PREVIEW_RAY.speedScale;
    const gravityScale = options?.gravityScale ?? DEFAULT_PREVIEW_RAY.gravityScale;
    return spreadOffsets.map((spreadRadians) => ({
        speedScale,
        gravityScale,
        spreadRadians,
    }));
}

export function createBallisticProjectile(
    input: WeaponFireInput,
    weaponType: WeaponType,
    weapon: Weapon,
    speedScale = 1,
    spreadRadians = 0,
    projectileSizeOverride?: number
): ProjectileBlueprint {
    const speed = weapon.projectileSpeed * clampPower(input.power) * speedScale;
    const angle = input.aim + spreadRadians;

    return {
        x: input.owner.x + input.owner.width / 2,
        y: input.owner.y + input.owner.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: projectileSizeOverride ?? weapon.projectileSize,
        weaponType,
        damage: weapon.damage,
        blastRadius: weapon.blastRadius,
        remainingPierces: weapon.piercing ?? 0,
    };
}

export const defaultStepProjectile = (projectile: Projectile, dt: number) => {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.vy += DEFAULT_GRAVITY * dt;
};

export const drawCircle = (ctx: CanvasRenderingContext2D, projectile: Projectile, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
};

export function buildBallisticAimPreview(
    input: WeaponAimPreviewInput,
    projectileSpeed: number,
    rays: WeaponPreviewRay[],
    style: Pick<WeaponAimPreview, "color" | "lineWidth" | "lineDash">
): WeaponAimPreview {
    const clampedPower = clampPower(input.power);
    const dt = 1 / 60;
    const maxSteps = 180;

    const paths = rays.map((ray) => {
        let x = input.originX;
        let y = input.originY;
        const angle = input.aim + ray.spreadRadians;
        const speed = projectileSpeed * clampedPower * ray.speedScale;
        const vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;
        const points = [{ x, y }];

        for (let i = 0; i < maxSteps; i++) {
            x += vx * dt;
            y += vy * dt;
            vy += DEFAULT_GRAVITY * ray.gravityScale * dt;

            if (x < 0 || x >= input.screenWidth || y < 0 || y >= input.screenHeight) {
                break;
            }

            points.push({ x, y });

            const terrainIndex = Math.floor(x) + Math.floor(y) * input.screenWidth;
            if (input.terrain[terrainIndex] === 1) {
                break;
            }
        }

        return points;
    });

    return {
        paths,
        color: style.color,
        lineWidth: style.lineWidth,
        lineDash: style.lineDash,
    };
}
