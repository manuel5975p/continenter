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
            // Create player
            const player: Character = {
                id: "player-1",
                x: 100,
                y: screenHeight - 150,
                width: 20,
                height: 30,
                health: 100,
                maxHealth: 100,
                velocity: { x: 0, y: 0 },
                isJumping: false,
                isBot: false,
            };

            // Create bots
            const bots: Character[] = [];
            const numBots = 2;
            for (let i = 0; i < numBots; i++) {
                const botX = screenWidth * ((i + 1) / (numBots + 1));
                bots.push({
                    id: `bot-${i}`,
                    x: botX,
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
            engine.initializeGame(player, bots);

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
