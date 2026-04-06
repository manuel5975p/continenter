import { Character, GameState, WeaponAmmoByType, WeaponType } from "../model/types";
import {
    getWeaponBehavior,
    shouldExpireProjectile,
    stepProjectileWithWeapon,
    WEAPONS,
    WEAPON_TYPES,
} from "../model/weapons";
import { PowerUp, PowerUpType, POWERUP_EFFECTS, POWERUP_TYPES_WITH_WEIGHTS } from "../model/powerups";

const GRAVITY = 600;
const GROUND_FRICTION = 0.92;
const PLAYER_SPEED = 100;
const TURN_DURATION_SECONDS = 10;
const BOT_ACTION_DELAY_SECONDS = 0.8;
const BOT_EARLY_FIRE_RANGE = 230;
const BOT_EARLY_FIRE_INTENT_PER_SECOND = 1.4;
const MAX_SIMULATION_STEP_SECONDS = 0.016;
const MAX_WALK_DISTANCE_PER_TURN = 130;
const MAX_UPHILL_SLOPE_RATIO = 1.0;
const POWERUP_SPAWN_INTERVAL_SECONDS = 4.5;
const POWERUP_RADIUS = 8;
const POWERUP_PICKUP_RADIUS = 30;
const BOT_POWERUP_PURSUIT_RANGE = 200;
const STARTING_ARMOR = 20;
const HEALTH_REGEN_PER_SECOND = 0.125;
const BOT_TURN_ID = "bots-turn";
const BOT_EFFECTIVE_RANGE_BY_WEAPON: Record<WeaponType, number> = {
    [WeaponType.PISTOL]: 320,
    [WeaponType.SHOTGUN]: 220,
    [WeaponType.GRENADE]: 280,
    [WeaponType.BAZOOKA]: 430,
    [WeaponType.FLAMETHROWER]: 170,
    [WeaponType.SNIPER]: 620,
};

export class GameEngine {
    private state: GameState;
    private botActionDelayLeft = BOT_ACTION_DELAY_SECONDS;
    private botsFiredThisTurn: Set<string> = new Set();
    private weaponIndexByEntityId: Record<string, number> = {};
    private remainingWalkDistanceByEntityId: Record<string, number> = {};
    private walkRangeOriginXByEntityId: Record<string, number> = {};
    private powerupSpawnTimerLeft = POWERUP_SPAWN_INTERVAL_SECONDS;

    constructor(screenWidth: number, screenHeight: number) {
        this.state = {
            players: [],
            bots: [],
            projectiles: [],
            powerups: [],
            explosions: [],
            terrain: new Uint8ClampedArray(screenWidth * screenHeight),
            screenWidth,
            screenHeight,
            currentPlayerIndex: 0,
            currentWeaponIndex: 0,
            gameTime: 0,
            turnOrder: [],
            currentTurnIndex: 0,
            currentTurnEntityId: "",
            turnTimeLeft: TURN_DURATION_SECONDS,
            hasFiredThisTurn: false,
            ammoByEntityId: {},
            armorByEntityId: {},
            maxWalkDistancePerTurn: MAX_WALK_DISTANCE_PER_TURN,
            remainingWalkDistanceByEntityId: {},
            walkRangeOriginXByEntityId: {},
            isGameOver: false,
        };

        this.generateTerrain();
    }

    private generateTerrain() {
        const { terrain, screenWidth, screenHeight } = this.state;
        terrain.fill(0);

        const base = screenHeight - 250;
        const heights: number[] = new Array(screenWidth);
        let currentHeight = base;

        for (let x = 0; x < screenWidth; x++) {
            currentHeight += (Math.random() - 0.5) * 2.5;
            const wave = Math.sin((x / screenWidth) * Math.PI * 3.5) * 35;
            const target = currentHeight + wave;
            heights[x] = Math.max(screenHeight * 0.45, Math.min(screenHeight - 40, target));
        }

        for (let pass = 0; pass < 4; pass++) {
            for (let x = 1; x < screenWidth - 1; x++) {
                heights[x] = (heights[x - 1] + heights[x] + heights[x + 1]) / 3;
            }
        }

        for (let x = 0; x < screenWidth; x++) {
            const groundY = Math.floor(heights[x]);
            for (let y = groundY; y < screenHeight; y++) {
                terrain[x + y * screenWidth] = 1;
            }
        }
    }

    public initializeGame(players: Character[], bots: Character[]) {
        const playerTeam = players.length > 0 ? players : [];
        if (playerTeam.length === 0) {
            return;
        }

        this.state.players = playerTeam;
        this.state.bots = bots;
        const humanPlayer = playerTeam[0];
        const allCharacters = [...playerTeam, ...bots];
        this.state.ammoByEntityId = {
            ...Object.fromEntries(allCharacters.map((character) => [character.id, this.createInitialAmmoLoadout()])),
        };
        this.state.armorByEntityId = {
            ...Object.fromEntries(allCharacters.map((character) => [character.id, STARTING_ARMOR])),
        };
        this.weaponIndexByEntityId = {
            ...Object.fromEntries(
                allCharacters.map((character) => [
                    character.id,
                    character.id === humanPlayer.id ? this.state.currentWeaponIndex : 0,
                ])
            ),
        };
        this.remainingWalkDistanceByEntityId = {
            ...Object.fromEntries(allCharacters.map((character) => [character.id, MAX_WALK_DISTANCE_PER_TURN])),
        };
        this.state.remainingWalkDistanceByEntityId = this.remainingWalkDistanceByEntityId;

        for (const character of allCharacters) {
            this.placeCharacterOnGround(character);
        }

        this.walkRangeOriginXByEntityId = {
            ...Object.fromEntries(allCharacters.map((character) => [character.id, character.x])),
        };
        this.state.walkRangeOriginXByEntityId = this.walkRangeOriginXByEntityId;

        this.state.turnOrder = bots.length > 0 ? [humanPlayer.id, BOT_TURN_ID] : [humanPlayer.id];
        this.state.currentTurnIndex = 0;
        this.state.currentTurnEntityId = this.state.turnOrder[0] ?? "";
        this.state.turnTimeLeft = TURN_DURATION_SECONDS;
        this.state.hasFiredThisTurn = false;
        this.botActionDelayLeft = BOT_ACTION_DELAY_SECONDS;
        this.botsFiredThisTurn = new Set();
        this.resetCurrentTurnWalkDistance();
    }

    public getState(): GameState {
        return { ...this.state };
    }

    public setCurrentWeaponIndex(index: number) {
        const weaponCount = Object.keys(WEAPONS).length;
        if (weaponCount === 0) return;

        const normalizedIndex = ((Math.floor(index) % weaponCount) + weaponCount) % weaponCount;
        this.state.currentWeaponIndex = normalizedIndex;

        const playerId = this.state.players[0]?.id;
        if (playerId) {
            this.weaponIndexByEntityId[playerId] = normalizedIndex;
        }
    }

    public skipShot() {
        const activeCharacter = this.getCharacterById(this.state.currentTurnEntityId);
        if (activeCharacter && !activeCharacter.isBot && !this.state.hasFiredThisTurn) {
            this.state.hasFiredThisTurn = true;
        }
    }

    public update(
        deltaTime: number,
        input: {
            moveLeft: boolean;
            moveRight: boolean;
            shoot: boolean;
            aim: number;
            power: number;
            changeWeapon: number;
        }
    ) {
        if (this.state.isGameOver) return;

        let remainingTime = Math.max(0, deltaTime) / 1000;
        let pendingWeaponChange = input.changeWeapon;

        while (remainingTime > 0 && !this.state.isGameOver) {
            const dt = Math.min(remainingTime, MAX_SIMULATION_STEP_SECONDS);
            this.stepSimulation(dt, {
                ...input,
                changeWeapon: pendingWeaponChange,
            });

            pendingWeaponChange = 0;
            remainingTime -= dt;
        }
    }

    private stepSimulation(
        dt: number,
        input: {
            moveLeft: boolean;
            moveRight: boolean;
            shoot: boolean;
            aim: number;
            power: number;
            changeWeapon: number;
        }
    ) {
        const activeCharacter = this.getCharacterById(this.state.currentTurnEntityId);
        const isPlayerTurn = Boolean(activeCharacter && !activeCharacter.isBot);

        if (isPlayerTurn && !this.state.hasFiredThisTurn && input.changeWeapon !== 0) {
            const weaponCount = WEAPON_TYPES.length;
            this.state.currentWeaponIndex =
                (this.state.currentWeaponIndex + input.changeWeapon + weaponCount) % weaponCount;

            const playerId = activeCharacter?.id;
            if (playerId) {
                this.weaponIndexByEntityId[playerId] = this.state.currentWeaponIndex;
            }
        }

        if (isPlayerTurn && activeCharacter) {
            this.updateCharacterMovement(
                activeCharacter,
                {
                    moveLeft: input.moveLeft,
                    moveRight: input.moveRight,
                },
                dt
            );

            this.updateAlliedBotsDuringPlayerTurn(dt);
        }

        const allCharacters = [...this.state.players, ...this.state.bots];

        if (!isPlayerTurn) {
            this.updateBotTurn(dt);
        }

        // Apply gravity and velocity to all characters
        for (const character of allCharacters) {
            this.applyGravityAndVelocity(character, dt);
        }

        this.updateProjectiles(dt);
        this.updateExplosions(dt);
        this.updatePowerups(dt);
        this.checkPowerupPickups();
        this.regenerateCharacterHealth(dt);
        this.syncTurnOrderWithLivingCharacters();

        if (this.state.isGameOver) {
            this.state.gameTime += dt;
            return;
        }

        if (
            isPlayerTurn &&
            activeCharacter &&
            input.shoot &&
            !this.state.hasFiredThisTurn &&
            this.state.projectiles.length === 0
        ) {
            const didFire = this.fireWeapon(activeCharacter, input.aim, input.power);
            if (didFire) {
                this.state.hasFiredThisTurn = true;
            }
        }

        this.state.turnTimeLeft = Math.max(0, this.state.turnTimeLeft - dt);

        const turnExpired = this.state.turnTimeLeft <= 0;
        const hasActiveProjectiles = this.state.projectiles.length > 0;

        if (!hasActiveProjectiles && (turnExpired || this.state.hasFiredThisTurn)) {
            this.advanceTurn();
        }

        this.state.gameTime += dt;
    }

    private updateBotTurn(dt: number) {
        if (this.state.players.length === 0) return;

        // Decrement shared action delay once per frame
        this.botActionDelayLeft -= dt;

        // Run each bot's logic simultaneously
        for (const bot of this.state.bots) {
            this.updateSingleBot(bot, dt, this.state.players);
        }

        // End the group turn once every living bot has fired
        const aliveBots = this.state.bots;
        if (aliveBots.length > 0 && aliveBots.every((b) => this.botsFiredThisTurn.has(b.id))) {
            this.state.hasFiredThisTurn = true;
        }
    }

    private updateAlliedBotsDuringPlayerTurn(dt: number) {
        if (this.state.bots.length === 0) {
            return;
        }

        const alliedBots = this.state.players.filter((character) => character.isBot);
        if (alliedBots.length === 0) {
            return;
        }

        this.botActionDelayLeft -= dt;

        for (const alliedBot of alliedBots) {
            this.updateSingleBot(alliedBot, dt, this.state.bots);
        }
    }

    private updateSingleBot(bot: Character, dt: number, opponents: Character[]) {
        const target = this.getNearestLivingTarget(bot, opponents);
        if (!target) {
            return;
        }

        const originX = bot.x + bot.width / 2;
        const originY = bot.y + bot.height / 2;

        // Check for nearby powerups
        const nearestPowerup = this.findNearestPowerup(originX, originY, BOT_POWERUP_PURSUIT_RANGE);
        if (nearestPowerup) {
            // Move toward powerup
            const powerupCenterX = nearestPowerup.x + nearestPowerup.radius;
            this.updateCharacterMovement(
                bot,
                {
                    moveLeft: powerupCenterX < originX,
                    moveRight: powerupCenterX > originX,
                },
                dt,
                0.35
            );
            return;
        }

        // Default behavior: pursue nearest target
        const targetX = target.x + target.width / 2;
        const targetY = target.y + target.height / 2;

        const dx = targetX - originX;
        const dy = targetY - originY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const inRangeWeaponIndex = this.getBestInRangeWeaponIndexForEntity(bot.id, distance);
        const canShootWithAnyWeapon = inRangeWeaponIndex !== undefined;

        if (!canShootWithAnyWeapon) {
            this.updateCharacterMovement(
                bot,
                {
                    moveLeft: target.x < bot.x,
                    moveRight: target.x > bot.x,
                },
                dt,
                0.35
            );
            return;
        }

        // Skip firing if this bot already fired or a projectile is still in flight
        if (this.botsFiredThisTurn.has(bot.id) || this.state.projectiles.length > 0) return;

        const inEarlyFireRange = distance <= BOT_EARLY_FIRE_RANGE;
        const wantsEarlyFire =
            inEarlyFireRange && this.rollChancePerSecond(BOT_EARLY_FIRE_INTENT_PER_SECOND, dt);

        if (this.botActionDelayLeft > 0 && !wantsEarlyFire) return;

        const aim = Math.atan2(dy, dx);
        const power = inEarlyFireRange ? 0.5 : 0.7;
        const didFire = this.fireWeapon(bot, aim, power, inRangeWeaponIndex);
        if (didFire) {
            this.botsFiredThisTurn.add(bot.id);
        }
    }

    private getNearestLivingTarget(source: Character, candidates: Character[]): Character | undefined {
        let nearestTarget: Character | undefined;
        let nearestDistanceSq = Number.POSITIVE_INFINITY;
        const sourceCenterX = source.x + source.width / 2;
        const sourceCenterY = source.y + source.height / 2;

        for (const candidate of candidates) {
            if (candidate.health <= 0) {
                continue;
            }

            const candidateCenterX = candidate.x + candidate.width / 2;
            const candidateCenterY = candidate.y + candidate.height / 2;
            const dx = candidateCenterX - sourceCenterX;
            const dy = candidateCenterY - sourceCenterY;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < nearestDistanceSq) {
                nearestDistanceSq = distanceSq;
                nearestTarget = candidate;
            }
        }

        return nearestTarget;
    }

    private rollChancePerSecond(chancePerSecond: number, dt: number): boolean {
        const chanceThisFrame = Math.max(0, Math.min(1, chancePerSecond * dt));
        return Math.random() < chanceThisFrame;
    }

    private updateCharacterMovement(
        character: Character,
        input: { moveLeft: boolean; moveRight: boolean },
        dt: number,
        speedScale = 1
    ) {
        const previousX = character.x;
        let targetVelocityX = 0;

        if (input.moveLeft) {
            targetVelocityX = -PLAYER_SPEED * speedScale;
        } else if (input.moveRight) {
            targetVelocityX = PLAYER_SPEED * speedScale;
        }

        if (targetVelocityX !== 0) {
            const remainingWalkDistance = this.getRemainingWalkDistance(character.id);
            if (remainingWalkDistance <= 0 || dt <= 0) {
                targetVelocityX = 0;
            } else {
                const maxVelocityThisFrame = remainingWalkDistance / dt;
                const clampedVelocityMagnitude = Math.min(Math.abs(targetVelocityX), maxVelocityThisFrame);
                targetVelocityX = Math.sign(targetVelocityX) * clampedVelocityMagnitude;
            }
        }

        if (targetVelocityX !== 0 && !this.canMoveUphill(character, targetVelocityX, dt)) {
            targetVelocityX = 0;
        }

        character.velocity.x = targetVelocityX;

        this.applyGravityAndVelocity(character, dt);

        const walkedDistance = Math.abs(character.x - previousX);
        if (walkedDistance > 0) {
            const remainingWalkDistance = this.getRemainingWalkDistance(character.id);
            this.remainingWalkDistanceByEntityId[character.id] = Math.max(0, remainingWalkDistance - walkedDistance);
        }

        if (this.getRemainingWalkDistance(character.id) <= 0) {
            character.velocity.x = 0;
        }
    }

    private applyGravityAndVelocity(character: Character, dt: number) {
        character.velocity.y += GRAVITY * dt;
        character.x += character.velocity.x * dt;
        character.y += character.velocity.y * dt;

        character.x = Math.max(0, Math.min(character.x, this.state.screenWidth - character.width));

        if (character.y > this.state.screenHeight) {
            character.health = 0;
            return;
        }

        this.resolveCharacterTerrain(character);

        if (this.isCharacterGrounded(character)) {
            character.velocity.x *= GROUND_FRICTION;
            if (character.velocity.y > 0) {
                character.velocity.y = 0;
            }
        }
    }

    private regenerateCharacterHealth(dt: number) {
        if (dt <= 0) return;

        for (const character of [...this.state.players, ...this.state.bots]) {
            if (character.health <= 0 || character.health >= character.maxHealth) {
                continue;
            }

            character.health = Math.min(character.maxHealth, character.health + HEALTH_REGEN_PER_SECOND * dt);
        }
    }

    private isCharacterGrounded(character: Character): boolean {
        const groundY = this.getGroundTopForCharacter(character) - character.height;
        return character.y >= groundY - 0.75 && character.y <= groundY + 1.5;
    }

    private resolveCharacterTerrain(character: Character) {
        const targetY = this.getGroundTopForCharacter(character) - character.height;
        if (character.y > targetY) {
            character.y = targetY;
            if (character.velocity.y > 0) {
                character.velocity.y = 0;
            }
        }
    }

    private canMoveUphill(character: Character, targetVelocityX: number, dt: number): boolean {
        if (dt <= 0 || targetVelocityX === 0) {
            return true;
        }

        const currentX = character.x;
        const proposedX = Math.max(
            0,
            Math.min(currentX + targetVelocityX * dt, this.state.screenWidth - character.width)
        );
        const horizontalRun = Math.abs(proposedX - currentX);
        if (horizontalRun <= 0) {
            return true;
        }

        const currentGroundTop = this.getGroundTopForCharacter(character, currentX);
        const proposedGroundTop = this.getGroundTopForCharacter(character, proposedX);
        const uphillRise = currentGroundTop - proposedGroundTop;
        if (uphillRise <= 0) {
            return true;
        }

        return uphillRise / horizontalRun <= MAX_UPHILL_SLOPE_RATIO;
    }

    private getGroundTopForCharacter(character: Character, characterX = character.x): number {
        const sampleXs = [
            characterX + 2,
            characterX + character.width / 2,
            characterX + character.width - 2,
        ];

        let minGroundY = this.state.screenHeight;
        for (const sampleX of sampleXs) {
            const clampedX = Math.max(0, Math.min(this.state.screenWidth - 1, Math.floor(sampleX)));
            const groundY = this.findGroundTopAtX(clampedX);
            if (groundY < minGroundY) {
                minGroundY = groundY;
            }
        }

        return minGroundY;
    }

    private findGroundTopAtX(x: number): number {
        for (let y = 0; y < this.state.screenHeight; y++) {
            const idx = x + y * this.state.screenWidth;
            if (this.state.terrain[idx] === 1) {
                return y;
            }
        }

        return this.state.screenHeight;
    }

    private placeCharacterOnGround(character: Character) {
        const targetY = this.getGroundTopForCharacter(character) - character.height;
        character.y = Math.max(0, targetY);
        character.velocity.y = 0;
    }

    private fireWeapon(character: Character, aim: number, power: number, weaponIndexOverride?: number): boolean {
        const weaponType = WEAPON_TYPES[this.getWeaponIndexForEntity(character.id, weaponIndexOverride)];
        if (!weaponType) return false;
        const weapon = WEAPONS[weaponType];
        const ammoByType = this.getOrCreateAmmoLoadout(character.id);
        const ammo = ammoByType[weaponType] ?? 0;

        if (ammo <= 0) return false;

        const behavior = getWeaponBehavior(weaponType);
        const spawnedProjectiles = behavior.spawnProjectiles(
            {
                owner: character,
                aim,
                power,
            },
            weapon
        );

        if (spawnedProjectiles.length === 0) return false;

        this.state.projectiles.push(
            ...spawnedProjectiles.map((projectile) => ({
                ...projectile,
                id: `proj-${Date.now()}-${Math.random()}`,
                ownerId: character.id,
                meta: { ...projectile.meta, spawnX: projectile.x, spawnY: projectile.y },
            }))
        );
        ammoByType[weaponType] = Math.max(0, ammo - 1);
        return true;
    }

    private getWeaponIndexForEntity(entityId: string, weaponIndexOverride?: number): number {
        if (weaponIndexOverride !== undefined) {
            return weaponIndexOverride;
        }

        const existing = this.weaponIndexByEntityId[entityId];
        if (existing !== undefined) {
            return existing;
        }

        const fallback = this.state.currentWeaponIndex;
        this.weaponIndexByEntityId[entityId] = fallback;
        return fallback;
    }

    private getBestInRangeWeaponIndexForEntity(entityId: string, distance: number): number | undefined {
        const weaponCount = WEAPON_TYPES.length;
        const currentIndex = this.getWeaponIndexForEntity(entityId);
        const ammoByType = this.getOrCreateAmmoLoadout(entityId);
        const currentType = WEAPON_TYPES[currentIndex];

        if (
            currentType &&
            (ammoByType[currentType] ?? 0) > 0 &&
            distance <= BOT_EFFECTIVE_RANGE_BY_WEAPON[currentType]
        ) {
            return currentIndex;
        }

        for (let offset = 1; offset <= weaponCount; offset++) {
            const candidateIndex = (currentIndex + offset) % weaponCount;
            const candidateType = WEAPON_TYPES[candidateIndex];
            if (!candidateType) continue;

            const hasAmmo = (ammoByType[candidateType] ?? 0) > 0;
            const inRange = distance <= BOT_EFFECTIVE_RANGE_BY_WEAPON[candidateType];
            if (hasAmmo && inRange) {
                this.weaponIndexByEntityId[entityId] = candidateIndex;
                return candidateIndex;
            }
        }

        return undefined;
    }

    private createInitialAmmoLoadout(): WeaponAmmoByType {
        return {
            [WeaponType.PISTOL]: WEAPONS[WeaponType.PISTOL].maxAmmo,
            [WeaponType.SHOTGUN]: WEAPONS[WeaponType.SHOTGUN].maxAmmo,
            [WeaponType.GRENADE]: WEAPONS[WeaponType.GRENADE].maxAmmo,
            [WeaponType.BAZOOKA]: WEAPONS[WeaponType.BAZOOKA].maxAmmo,
            [WeaponType.FLAMETHROWER]: WEAPONS[WeaponType.FLAMETHROWER].maxAmmo,
            [WeaponType.SNIPER]: WEAPONS[WeaponType.SNIPER].maxAmmo,
        };
    }

    private getOrCreateAmmoLoadout(entityId: string): WeaponAmmoByType {
        const existing = this.state.ammoByEntityId[entityId];
        if (existing) {
            return existing;
        }

        const created = this.createInitialAmmoLoadout();
        this.state.ammoByEntityId[entityId] = created;
        return created;
    }

    private updateProjectiles(dt: number) {
        this.state.projectiles = this.state.projectiles.filter((projectile) => {
            stepProjectileWithWeapon(projectile, dt);

            if (shouldExpireProjectile(projectile)) {
                this.createExplosion(projectile.x, projectile.y, projectile.blastRadius, projectile.damage);
                return false;
            }

            if (
                projectile.x < 0 ||
                projectile.x > this.state.screenWidth ||
                projectile.y < 0 ||
                projectile.y > this.state.screenHeight
            ) {
                return false;
            }

            const terrainIndex =
                Math.floor(projectile.x) + Math.floor(projectile.y) * this.state.screenWidth;
            if (this.state.terrain[terrainIndex] === 1) {
                if (!projectile.meta?.ownerCleared) {
                    // still inside the owner's body — skip terrain until the projectile clears it
                } else {
                    this.createExplosion(projectile.x, projectile.y, projectile.blastRadius, projectile.damage);
                    return false;
                }
            }

            for (const target of [...this.state.players, ...this.state.bots]) {
                if (target.id === projectile.ownerId) {
                    if (!projectile.meta?.ownerCleared) {
                        const spawnX = projectile.meta?.spawnX as number | undefined;
                        const spawnY = projectile.meta?.spawnY as number | undefined;
                        if (spawnX !== undefined && spawnY !== undefined) {
                            const dx = projectile.x - spawnX;
                            const dy = projectile.y - spawnY;
                            const travelDist = Math.sqrt(dx * dx + dy * dy);
                            const clearThreshold = projectile.radius + Math.max(target.width, target.height);
                            if (travelDist < clearThreshold) continue;
                            projectile.meta = { ...projectile.meta, ownerCleared: true };
                        }
                    }
                }

                const alreadyHitTarget = Boolean(projectile.meta?.[`hit_${target.id}`]);
                if (alreadyHitTarget) {
                    continue;
                }

                const dx = target.x + target.width / 2 - projectile.x;
                const dy = target.y + target.height / 2 - projectile.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < projectile.radius + Math.max(target.width, target.height) / 2) {
                    this.applyDamage(target, projectile.damage);
                    projectile.meta = {
                        ...projectile.meta,
                        [`hit_${target.id}`]: true,
                    };

                    const remainingPierces = projectile.remainingPierces ?? 0;
                    if (remainingPierces > 0) {
                        projectile.remainingPierces = remainingPierces - 1;
                        continue;
                    }

                    this.createExplosion(projectile.x, projectile.y, projectile.blastRadius, projectile.damage);
                    return false;
                }
            }

            return true;
        });

        this.state.bots = this.state.bots.filter((bot) => bot.health > 0);
        this.state.players = this.state.players.filter((player) => player.health > 0);
    }

    private createExplosion(x: number, y: number, radius: number, damage: number) {
        this.state.explosions.push({
            x,
            y,
            radius,
            age: 0,
            maxAge: 0.5,
        });

        // Track which characters were grounded before terrain destruction
        const wasGroundedBefore = new Map<string, boolean>();
        for (const character of [...this.state.players, ...this.state.bots]) {
            wasGroundedBefore.set(character.id, this.isCharacterGrounded(character));
        }

        this.damageTerrainAt(x, y, radius);

        for (const character of [...this.state.players, ...this.state.bots]) {
            const dx = character.x + character.width / 2 - x;
            const dy = character.y + character.height / 2 - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < radius) {
                const falloff = 1 - distance / radius;
                this.applyDamage(character, damage * falloff);

                if (distance > 0) {
                    character.velocity.x = (dx / distance) * 300 * falloff;
                    character.velocity.y = (dy / distance) * 300 * falloff;
                }

                // If character was grounded but lost ground support due to explosion, make them fall
                const wasGrounded = wasGroundedBefore.get(character.id) ?? false;
                const isNowGrounded = this.isCharacterGrounded(character);
                if (wasGrounded && !isNowGrounded) {
                    character.isJumping = true;
                }
            }
        }
    }

    private damageTerrainAt(x: number, y: number, radius: number) {
        const radiusSquared = radius * radius;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (dx * dx + dy * dy <= radiusSquared) {
                    const px = Math.floor(x + dx);
                    const py = Math.floor(y + dy);
                    if (px >= 0 && px < this.state.screenWidth && py >= 0 && py < this.state.screenHeight) {
                        const idx = px + py * this.state.screenWidth;
                        this.state.terrain[idx] = 0;
                    }
                }
            }
        }
    }

    private updateExplosions(dt: number) {
        this.state.explosions = this.state.explosions.filter((explosion) => {
            explosion.age += dt;
            return explosion.age < explosion.maxAge;
        });
    }

    private applyDamage(character: Character, damage: number) {
        if (damage <= 0) {
            return;
        }

        const currentArmor = this.state.armorByEntityId[character.id] ?? 0;
        const absorbedDamage = Math.min(currentArmor, damage);
        const remainingDamage = damage - absorbedDamage;

        this.state.armorByEntityId[character.id] = Math.max(0, currentArmor - absorbedDamage);

        if (remainingDamage > 0) {
            character.health = Math.max(0, character.health - remainingDamage);
        }
    }

    private getCharacterById(id: string): Character | undefined {
        return [...this.state.players, ...this.state.bots].find((character) => character.id === id);
    }

    private syncTurnOrderWithLivingCharacters() {
        const livingCharacters = [...this.state.players, ...this.state.bots];
        const livingIds = new Set(livingCharacters.map((character) => character.id));
        const currentTurnId = this.state.currentTurnEntityId;

        for (const entityId of Object.keys(this.state.ammoByEntityId)) {
            if (!livingIds.has(entityId)) {
                delete this.state.ammoByEntityId[entityId];
            }
        }

        for (const entityId of Object.keys(this.weaponIndexByEntityId)) {
            if (!livingIds.has(entityId)) {
                delete this.weaponIndexByEntityId[entityId];
            }
        }

        for (const entityId of Object.keys(this.state.armorByEntityId)) {
            if (!livingIds.has(entityId)) {
                delete this.state.armorByEntityId[entityId];
            }
        }

        for (const entityId of Object.keys(this.remainingWalkDistanceByEntityId)) {
            if (!livingIds.has(entityId)) {
                delete this.remainingWalkDistanceByEntityId[entityId];
            }
        }

        for (const entityId of Object.keys(this.walkRangeOriginXByEntityId)) {
            if (!livingIds.has(entityId)) {
                delete this.walkRangeOriginXByEntityId[entityId];
            }
        }

        // Keep the sentinel as long as any bot is alive; filter real entity IDs normally
        this.state.turnOrder = this.state.turnOrder.filter((id) =>
            id === BOT_TURN_ID ? this.state.bots.length > 0 : livingIds.has(id)
        );

        if (this.state.players.length === 0) {
            this.state.isGameOver = true;
            this.state.winner = "Enemy Team";
            return;
        }

        if (this.state.bots.length === 0) {
            this.state.isGameOver = true;
            this.state.winner = "Player Team";
            return;
        }

        if (!this.state.turnOrder.length) {
            const ids: string[] = this.state.players.map((p) => p.id);
            if (this.state.bots.length > 0) ids.push(BOT_TURN_ID);
            this.state.turnOrder = ids;
        }

        const currentIndex = this.state.turnOrder.indexOf(currentTurnId);
        if (currentIndex === -1) {
            this.state.currentTurnIndex = 0;
            this.state.currentTurnEntityId = this.state.turnOrder[0] ?? "";
            this.state.turnTimeLeft = TURN_DURATION_SECONDS;
            this.state.hasFiredThisTurn = false;
            this.botActionDelayLeft = BOT_ACTION_DELAY_SECONDS;
            this.resetCurrentTurnWalkDistance();
        } else {
            this.state.currentTurnIndex = currentIndex;
            this.state.currentTurnEntityId = this.state.turnOrder[currentIndex];
        }
    }

    private advanceTurn() {
        if (!this.state.turnOrder.length) return;

        this.state.currentTurnIndex = (this.state.currentTurnIndex + 1) % this.state.turnOrder.length;
        this.state.currentTurnEntityId = this.state.turnOrder[this.state.currentTurnIndex];
        this.state.turnTimeLeft = TURN_DURATION_SECONDS;
        this.state.hasFiredThisTurn = false;
        this.botActionDelayLeft = BOT_ACTION_DELAY_SECONDS;
        this.botsFiredThisTurn = new Set();
        this.resetCurrentTurnWalkDistance();
    }

    private getRemainingWalkDistance(entityId: string): number {
        const remaining = this.remainingWalkDistanceByEntityId[entityId];
        if (typeof remaining === "number") {
            return Math.max(0, remaining);
        }

        this.remainingWalkDistanceByEntityId[entityId] = MAX_WALK_DISTANCE_PER_TURN;
        return MAX_WALK_DISTANCE_PER_TURN;
    }

    private resetCurrentTurnWalkDistance() {
        const currentEntityId = this.state.currentTurnEntityId;
        if (!currentEntityId) return;

        if (currentEntityId === BOT_TURN_ID) {
            // Reset walk distance for all bots simultaneously
            for (const bot of this.state.bots) {
                this.remainingWalkDistanceByEntityId[bot.id] = MAX_WALK_DISTANCE_PER_TURN;
                this.walkRangeOriginXByEntityId[bot.id] = bot.x;
            }
            return;
        }

        this.remainingWalkDistanceByEntityId[currentEntityId] = MAX_WALK_DISTANCE_PER_TURN;

        const currentCharacter = this.getCharacterById(currentEntityId);
        if (currentCharacter) {
            this.walkRangeOriginXByEntityId[currentEntityId] = currentCharacter.x;
        }

        for (const allyBot of this.state.players.filter((character) => character.isBot)) {
            this.remainingWalkDistanceByEntityId[allyBot.id] = MAX_WALK_DISTANCE_PER_TURN;
            this.walkRangeOriginXByEntityId[allyBot.id] = allyBot.x;
        }
    }

    private updatePowerups(dt: number) {
        // Apply gravity to powerups
        for (const powerup of this.state.powerups) {
            powerup.velocity.y += GRAVITY * dt;
            powerup.y += powerup.velocity.y * dt;

            // Check collision with terrain
            const powerupX = Math.round(powerup.x);
            const powerupY = Math.round(powerup.y + powerup.radius);

            // Remove powerup if it falls out of the world
            if (powerup.y > this.state.screenHeight) {
                continue;
            }

            if (
                powerupX >= 0 &&
                powerupX < this.state.screenWidth &&
                powerupY >= 0 &&
                powerupY < this.state.screenHeight
            ) {
                const terrainIndex = powerupX + powerupY * this.state.screenWidth;
                if (this.state.terrain[terrainIndex]) {
                    // Hit terrain, stop falling
                    powerup.velocity.y = 0;
                    powerup.y = powerupY - powerup.radius;
                }
            }
        }

        this.state.powerups = this.state.powerups.filter((p) => p.y <= this.state.screenHeight);

        // Spawn new powerups periodically
        this.powerupSpawnTimerLeft -= dt;
        if (this.powerupSpawnTimerLeft <= 0) {
            this.spawnRandomPowerup();
            this.powerupSpawnTimerLeft = POWERUP_SPAWN_INTERVAL_SECONDS;
        }
    }

    private checkPowerupPickups() {
        const allCharacters = [...this.state.players, ...this.state.bots];

        for (const character of allCharacters) {
            const charCenterX = character.x + character.width / 2;
            const charCenterY = character.y + character.height / 2;

            for (let i = this.state.powerups.length - 1; i >= 0; i--) {
                const powerup = this.state.powerups[i];
                const dx = powerup.x - charCenterX;
                const dy = powerup.y - charCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < POWERUP_PICKUP_RADIUS + character.width / 2) {
                    this.applyPowerupEffect(character, powerup);
                    this.state.powerups.splice(i, 1);
                }
            }
        }
    }

    private spawnRandomPowerup() {
        // Get list of powerup types that don't already exist on map
        const existingTypes = new Set(this.state.powerups.map(p => p.type));
        const ammoTypes = [
            PowerUpType.PISTOL_AMMO,
            PowerUpType.SHOTGUN_AMMO,
            PowerUpType.GRENADE_AMMO,
            PowerUpType.BAZOOKA_AMMO,
            PowerUpType.FLAMETHROWER_AMMO,
            PowerUpType.SNIPER_AMMO,
        ];

        // Check if any ammo powerup exists
        const hasAmmo = ammoTypes.some(type => existingTypes.has(type));

        // Filter available types: exclude existing types and exclude ammo if one already exists
        const availableTypes = POWERUP_TYPES_WITH_WEIGHTS.filter(item => {
            if (existingTypes.has(item.type)) return false;
            if (hasAmmo && ammoTypes.includes(item.type)) return false;
            return true;
        });

        // If all types are already spawned, don't spawn another
        if (availableTypes.length === 0) {
            return;
        }

        // Pick a random type from available ones, respecting weights
        const totalWeight = availableTypes.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;
        let powerupType = availableTypes[0].type;

        for (const item of availableTypes) {
            random -= item.weight;
            if (random <= 0) {
                powerupType = item.type;
                break;
            }
        }

        const x = Math.random() * (this.state.screenWidth - 40) + 20;
        const y = 50;

        const effect = POWERUP_EFFECTS[powerupType];

        const powerup: PowerUp = {
            id: `powerup-${Date.now()}-${Math.random()}`,
            type: powerupType,
            x,
            y,
            radius: POWERUP_RADIUS,
            velocity: { x: 0, y: 0 },
            value: effect.value,
        };

        this.state.powerups.push(powerup);
    }

    private findNearestPowerup(originX: number, originY: number, maxDistance: number): PowerUp | null {
        let nearest: PowerUp | null = null;
        let nearestDistance = maxDistance;

        for (const powerup of this.state.powerups) {
            const dx = powerup.x - originX;
            const dy = powerup.y - originY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = powerup;
            }
        }

        return nearest;
    }

    private applyPowerupEffect(character: Character, powerup: PowerUp) {
        const effect = POWERUP_EFFECTS[powerup.type];

        switch (powerup.type) {
            case PowerUpType.HEALTH:
                character.health = Math.min(character.health + effect.value, character.maxHealth);
                break;

            case PowerUpType.ARMOR:
                this.state.armorByEntityId[character.id] = (this.state.armorByEntityId[character.id] ?? 0) + effect.value;
                break;

            case PowerUpType.PISTOL_AMMO:
            case PowerUpType.SHOTGUN_AMMO:
            case PowerUpType.GRENADE_AMMO:
            case PowerUpType.BAZOOKA_AMMO:
            case PowerUpType.FLAMETHROWER_AMMO:
            case PowerUpType.SNIPER_AMMO:
                this.applyAmmoPowerup(character, powerup, effect);
                break;
        }
    }

    private applyAmmoPowerup(character: Character, powerup: PowerUp, effect: typeof POWERUP_EFFECTS[PowerUpType]) {
        const weaponTypeMap: Record<PowerUpType, WeaponType> = {
            [PowerUpType.PISTOL_AMMO]: WeaponType.PISTOL,
            [PowerUpType.SHOTGUN_AMMO]: WeaponType.SHOTGUN,
            [PowerUpType.GRENADE_AMMO]: WeaponType.GRENADE,
            [PowerUpType.BAZOOKA_AMMO]: WeaponType.BAZOOKA,
            [PowerUpType.FLAMETHROWER_AMMO]: WeaponType.FLAMETHROWER,
            [PowerUpType.SNIPER_AMMO]: WeaponType.SNIPER,
            [PowerUpType.HEALTH]: WeaponType.PISTOL,
            [PowerUpType.ARMOR]: WeaponType.PISTOL,
        };

        const weaponType = weaponTypeMap[powerup.type];
        const weapon = WEAPONS[weaponType];

        if (!this.state.ammoByEntityId[character.id]) {
            this.state.ammoByEntityId[character.id] = this.createInitialAmmoLoadout();
        }

        this.state.ammoByEntityId[character.id][weaponType] = Math.min(
            (this.state.ammoByEntityId[character.id][weaponType] ?? 0) + effect.value,
            weapon.maxAmmo
        );
    }
}
