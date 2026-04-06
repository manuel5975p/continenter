import { create } from "zustand";
import { GameState, Character, GameInput, WeaponType } from "../model/types";
import { GameEngine } from "../engine/GameEngine";
import { WEAPONS, WEAPON_TYPES } from "../model/weapons";

interface GameStore {
    state: GameState;
    engine: GameEngine | null;
    playerInput: GameInput;
    gameTime: number;
    gameSpeed: number;
    initializeGame: (screenWidth: number, screenHeight: number) => void;
    updateGame: () => void;
    setInput: (input: Partial<GameInput>) => void;
    setGameSpeed: (speed: number) => void;
    selectWeapon: (weaponIndex: number) => void;
    skipShot: () => void;
    getCurrentWeapon: (entityId?: string) => (typeof WEAPONS)[WeaponType];
}

export const useGameStore = create<GameStore>((set, get) => {
    let lastTime = Date.now();
    const playerTeamSize = 2;
    const enemyTeamSize = 2;

    const createSpawnXs = (
        count: number,
        screenWidth: number,
        minPercent: number,
        maxPercent: number
    ) => {
        const minX = screenWidth * minPercent;
        const maxX = screenWidth * maxPercent;
        const minSpacing = 28;
        const spawns: number[] = [];

        for (let i = 0; i < count; i++) {
            let nextX = minX + Math.random() * Math.max(1, maxX - minX);
            let attempts = 0;

            while (attempts < 16 && spawns.some((x) => Math.abs(x - nextX) < minSpacing)) {
                nextX = minX + Math.random() * Math.max(1, maxX - minX);
                attempts += 1;
            }

            spawns.push(nextX);
        }

        return spawns.sort((a, b) => a - b);
    };

    return {
        state: {
            players: [],
            bots: [],
            projectiles: [],
            powerups: [],
            explosions: [],
            terrain: new Uint8ClampedArray(0),
            screenWidth: 0,
            screenHeight: 0,
            currentPlayerIndex: 0,
            currentWeaponIndex: 0,
            gameTime: 0,
            turnOrder: [],
            currentTurnIndex: 0,
            currentTurnEntityId: "",
            turnTimeLeft: 0,
            hasFiredThisTurn: false,
            ammoByEntityId: {},
            armorByEntityId: {},
            maxWalkDistancePerTurn: 130,
            remainingWalkDistanceByEntityId: {},
            walkRangeOriginXByEntityId: {},
            isGameOver: false,
        },
        engine: null,
        playerInput: {
            moveLeft: false,
            moveRight: false,
            aim: 0,
            power: 0.5,
            shoot: false,
            changeWeapon: 0,
        },
        gameTime: 0,
        gameSpeed: 1,

        initializeGame: (screenWidth: number, screenHeight: number) => {
            const playerTeamCount = Math.max(1, playerTeamSize);
            const enemyTeamCount = Math.max(1, enemyTeamSize);
            const playerSpawnXs = createSpawnXs(playerTeamCount, screenWidth, 0.2, 0.4);
            const enemySpawnXs = createSpawnXs(enemyTeamCount, screenWidth, 0.6, 0.8);

            const players: Character[] = [
                {
                    id: "player-1",
                    x: playerSpawnXs[0] ?? screenWidth * 0.25,
                    y: screenHeight - 150,
                    width: 20,
                    height: 30,
                    health: 100,
                    maxHealth: 100,
                    velocity: { x: 0, y: 0 },
                    isJumping: false,
                    isBot: false,
                },
            ];

            for (let i = 1; i < playerTeamCount; i++) {
                players.push({
                    id: `ally-bot-${i}`,
                    x: playerSpawnXs[i] ?? screenWidth * 0.3,
                    y: screenHeight - 150,
                    width: 20,
                    height: 30,
                    health: 100,
                    maxHealth: 100,
                    velocity: { x: 0, y: 0 },
                    isJumping: false,
                    isBot: true,
                });
            }

            const bots: Character[] = [];
            for (let i = 0; i < enemyTeamCount; i++) {
                bots.push({
                    id: `enemy-bot-${i}`,
                    x: enemySpawnXs[i] ?? screenWidth * 0.7,
                    y: screenHeight - 150,
                    width: 20,
                    height: 30,
                    health: 100,
                    maxHealth: 100,
                    velocity: { x: 0, y: 0 },
                    isJumping: false,
                    isBot: true,
                });
            }

            const engine = new GameEngine(screenWidth, screenHeight);
            engine.initializeGame(players, bots);

            set({
                engine,
                state: engine.getState(),
            });

            lastTime = Date.now();
        },

        updateGame: () => {
            const store = get();
            if (!store.engine) return;

            const now = Date.now();
            const deltaTime = Math.min(now - lastTime, 50); // Cap at 50ms
            lastTime = now;

            const isBotTurn = !store.state.players.some(
                (p) => p.id === store.state.currentTurnEntityId
            );
            const scaledDeltaTime = isBotTurn ? deltaTime * store.gameSpeed : deltaTime;

            store.engine.update(scaledDeltaTime, store.playerInput);
            const newState = store.engine.getState();

            set({
                state: { ...newState },
                gameTime: newState.gameTime,
            });

            // Reset shoot flag
            set((state) => ({
                playerInput: {
                    ...state.playerInput,
                    shoot: false,
                    changeWeapon: 0,
                },
            }));
        },

        setInput: (input: Partial<GameInput>) => {
            set((state) => ({
                playerInput: {
                    ...state.playerInput,
                    ...input,
                },
            }));
        },

        setGameSpeed: (speed: number) => {
            const allowedSpeeds = [1, 2.5, 5];
            const normalizedSpeed = allowedSpeeds.reduce((best, candidate) => {
                const candidateDistance = Math.abs(candidate - speed);
                const bestDistance = Math.abs(best - speed);
                return candidateDistance < bestDistance ? candidate : best;
            }, allowedSpeeds[0]);

            set({ gameSpeed: normalizedSpeed });
        },

        selectWeapon: (weaponIndex: number) => {
            const store = get();
            if (!store.engine) return;

            store.engine.setCurrentWeaponIndex(weaponIndex);
            set({ state: store.engine.getState() });
        },

        skipShot: () => {
            const store = get();
            if (!store.engine) return;

            store.engine.skipShot();
            set({ state: store.engine.getState() });
        },

        getCurrentWeapon: (entityId?: string) => {
            const store = get();
            const weaponType = WEAPON_TYPES[store.state.currentWeaponIndex] ?? WEAPON_TYPES[0];
            const weapon = WEAPONS[weaponType];
            const playerId = store.state.players[0]?.id;
            const ownerId = entityId ?? playerId;
            const ammo = ownerId ? store.state.ammoByEntityId[ownerId]?.[weaponType] ?? weapon.maxAmmo : weapon.maxAmmo;

            return {
                ...weapon,
                ammo,
            };
        },
    };
});
