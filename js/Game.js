/**
 * Game.js — Core game state machine for CHANGE SPOTTER
 * Manages round flow: MENU → MEMORIZE → CHANGE → OBSERVE → LEVEL COMPLETE / GAME OVER
 * Handles timers, scoring, lives, and level progression.
 */

import { Room } from './Room.js';
import { PlayerControls } from './PlayerControls.js';
import { UI } from './UI.js';
import { SoundManager } from './SoundManager.js';
import { isTouchDevice } from './utils.js';


/** Game states */
const STATE = {
    MENU: 'menu',
    MEMORIZE: 'memorize',
    CHANGE_FLASH: 'change_flash',
    OBSERVE: 'observe',
    LEVEL_COMPLETE: 'level_complete',
    GAME_OVER: 'game_over',
};

/** Maximum levels */
const MAX_LEVEL = 5;
/** Memorisation time in seconds */
const MEMO_TIME = 30;
/** Observation time in seconds */
const OBS_TIME = 60;
/** Starting lives */
const STARTING_LIVES = 3;
/** Points per correct selection */
const POINTS_PER_CHANGE = 10;
/** Bonus multiplier (points per remaining second) */
const BONUS_MULTIPLIER = 2;

export class Game {
    /**
     * @param {import('three').Scene} scene - Three.js scene
     * @param {import('three').Camera} camera - Three.js camera
     * @param {HTMLElement} domElement - Renderer DOM element
     */
    constructor(scene, camera, domElement) {
        /** @type {import('three').Scene} */
        this.scene = scene;
        /** @type {import('three').Camera} */
        this.camera = camera;

        // Initialise subsystems
        /** @type {SoundManager} */
        this.sound = new SoundManager();
        /** @type {UI} */
        this.ui = new UI(this.sound);
        /** @type {Room} */
        this.room = new Room(scene);
        /** @type {PlayerControls} */
        this.controls = new PlayerControls(camera, domElement, this.ui, scene);

        // Game state
        /** @type {string} Current state */
        this.state = STATE.MENU;
        /** @type {number} Current level (1-5) */
        this.level = 1;
        /** @type {number} Current score */
        this.score = 0;
        /** @type {number} Remaining lives */
        this.lives = STARTING_LIVES;
        /** @type {number} Remaining time in current phase */
        this.timeRemaining = 0;
        /** @type {number} Total changes found (for stats) */
        this.totalChangesFound = 0;
        /** @type {number} Total selection attempts (for stats) */
        this.totalAttempts = 0;
        /** @type {number} High score from localStorage */
        this.highScore = this._loadHighScore();

        // Animation state for correct/wrong feedback
        /** @type {Array<{mesh: THREE.Mesh, timer: number, type: string}>} */
        this.feedbackAnimations = [];

        // Bind UI callbacks
        this._bindUICallbacks();

        // Bind controls callback
        this.controls.onObjectSelected = (mesh) => this._handleObjectSelected(mesh);

        // Show main menu
        this.ui.updateHighScore(this.highScore);
        this.ui.showMenu('main');
    }

    /**
     * Binds UI button callbacks to game actions.
     */
    _bindUICallbacks() {
        this.ui.onStartGame = () => this.startGame();
        this.ui.onNextLevel = () => this._nextLevel();
        this.ui.onRetry = () => this.startGame();
        this.ui.onMainMenu = () => this._goToMainMenu();
    }

    /**
     * Starts a new game from level 1.
     */
    startGame() {
        // Initialise audio context (must be from user gesture)
        this.sound.init();

        this.level = 1;
        this.score = 0;
        this.lives = STARTING_LIVES;
        this.totalChangesFound = 0;
        this.totalAttempts = 0;
        this.feedbackAnimations = [];

        // Reset camera
        this.controls.reset();

        // Auto fullscreen on mobile (user gesture already happened via button click)
        if (isTouchDevice()) {
            UI.requestFullscreen();
        }

        // Spawn objects and start memorisation
        this.room.spawnObjects();
        this._startMemorizePhase();
    }


    /**
     * Starts the memorisation phase.
     */
    _startMemorizePhase() {
        this.state = STATE.MEMORIZE;
        this.timeRemaining = MEMO_TIME;
        this.controls.setActive(true);
        this.ui.showHUD(true);
        this.ui.showMenu('none');
        this.ui.updateHUD(this.level, this.timeRemaining, this.score, this.lives, this.room.getTotalChanges());
    }

    /**
     * Transitions to the change flash phase.
     * Fades to black, teleports camera, applies changes, then fades back in.
     */
    async _startChangeFlashPhase() {
        this.state = STATE.CHANGE_FLASH;
        this.controls.setActive(false);

        // Play change sound
        this.sound.playChangeFlash();

        // Fade to black (1.5s)
        await this.ui.fadeToBlack(1500);

        // Teleport camera to a random position in the room
        this.controls.teleportRandom();

        // Apply changes to objects
        this.room.applyChanges(this.level);

        // Brief pause while black
        await new Promise(resolve => setTimeout(resolve, 300));

        // Fade back in (0.5s)
        await this.ui.fadeFromBlack(500);

        // Start observation phase
        this._startObservePhase();
    }


    /**
     * Starts the observation phase.
     */
    _startObservePhase() {
        this.state = STATE.OBSERVE;
        this.timeRemaining = OBS_TIME;
        this.controls.setActive(true);
        this.ui.updateHUD(this.level, this.timeRemaining, this.score, this.lives, this.room.getRemainingChanges());
    }

    /**
     * Handles an object being selected by the player.
     * @param {THREE.Mesh} mesh - The selected mesh
     */
    _handleObjectSelected(mesh) {
        if (this.state !== STATE.OBSERVE) return;

        const obj = this.room.getObjectByMesh(mesh);
        if (!obj) return;

        this.totalAttempts++;

        // Check if this object was changed and not yet found
        if (obj.changed && !obj.found) {
            // Correct selection!
            this._onCorrectSelection(obj);
        } else if (!obj.changed || obj.found) {
            // Wrong selection (either unchanged or already found)
            this._onWrongSelection();
        }
    }

    /**
     * Handles a correct object selection.
     * @param {object} obj - The object data
     */
    _onCorrectSelection(obj) {
        // Mark as found
        this.room.markFound(obj.id);
        this.totalChangesFound++;
        this.score += POINTS_PER_CHANGE;

        // Sound and haptic feedback
        this.sound.playCorrect();
        if (navigator.vibrate) navigator.vibrate(50);

        // Visual feedback: green pulse then fade
        this._startFeedbackAnimation(obj.mesh, 'correct');

        // Update HUD
        const remaining = this.room.getRemainingChanges();
        this.ui.updateHUD(this.level, this.timeRemaining, this.score, this.lives, remaining);

        // Check if all changes found
        if (this.room.allChangesFound()) {
            this._onLevelComplete();
        }
    }

    /**
     * Handles a wrong selection.
     */
    _onWrongSelection() {
        this.lives--;

        // Sound and haptic feedback
        this.sound.playWrong();
        if (navigator.vibrate) navigator.vibrate(200);

        // Visual feedback
        this.ui.flashRed();
        this.ui.shakeHearts();

        // Update HUD
        this.ui.updateHUD(this.level, this.timeRemaining, this.score, this.lives, this.room.getRemainingChanges());

        // Check for game over
        if (this.lives <= 0) {
            this._onGameOver();
        }
    }

    /**
     * Starts a feedback animation on a mesh.
     * @param {THREE.Mesh} mesh - The mesh to animate
     * @param {'correct'|'wrong'} type - Animation type
     */
    _startFeedbackAnimation(mesh, type) {
        if (type === 'correct') {
            // Green highlight + pulse + fade out
            mesh.material.transparent = true;
            const originalColor = mesh.material.color.getHex();
            mesh.material.color.setHex(0x00FF88);

            this.feedbackAnimations.push({
                mesh: mesh,
                timer: 0,
                type: 'correct',
                originalColor: originalColor,
            });
        }
    }

    /**
     * Updates feedback animations.
     * @param {number} delta - Time delta in seconds
     */
    _updateFeedbackAnimations(delta) {
        for (let i = this.feedbackAnimations.length - 1; i >= 0; i--) {
            const anim = this.feedbackAnimations[i];
            anim.timer += delta;

            if (anim.type === 'correct') {
                // Pulse scale: 1 → 1.2 → 1 over 0.5s, then fade out
                const progress = Math.min(anim.timer / 0.8, 1);
                if (progress < 0.5) {
                    const scale = 1 + 0.2 * Math.sin(progress * Math.PI * 2);
                    anim.mesh.scale.set(scale, scale, scale);
                } else {
                    // Fade out
                    const fadeProgress = (progress - 0.5) / 0.5;
                    anim.mesh.material.opacity = 1 - fadeProgress;
                    anim.mesh.scale.set(1, 1, 1);
                }

                if (progress >= 1) {
                    // Remove from scene
                    this.scene.remove(anim.mesh);
                    this.feedbackAnimations.splice(i, 1);
                }
            }
        }
    }

    /**
     * Called when all changes are found — level complete.
     */
    _onLevelComplete() {
        this.state = STATE.LEVEL_COMPLETE;
        this.controls.setActive(false);

        // Calculate time bonus
        const bonus = Math.ceil(this.timeRemaining * BONUS_MULTIPLIER);
        this.score += bonus;

        // Sound and effects
        this.sound.playLevelComplete();
        this.ui.startConfetti();

        // Update high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this._saveHighScore(this.highScore);
            this.ui.updateHighScore(this.highScore);
        }

        // Show level complete screen
        this.ui.showLevelComplete(this.score, bonus);
    }

    /**
     * Called when lives reach 0 — game over.
     */
    _onGameOver() {
        this.state = STATE.GAME_OVER;
        this.controls.setActive(false);

        // Sound
        this.sound.playGameOver();

        // Update high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this._saveHighScore(this.highScore);
            this.ui.updateHighScore(this.highScore);
        }

        // Show game over screen
        this.ui.showGameOver(this.level, this.score, this.totalChangesFound, this.totalAttempts);
    }

    /**
     * Advances to the next level.
     */
    _nextLevel() {
        if (this.level >= MAX_LEVEL) {
            // Game completed all levels!
            this._onGameComplete();
            return;
        }

        this.level++;
        this.feedbackAnimations = [];

        // Reset camera
        this.controls.reset();

        // Spawn fresh objects and start memorisation
        this.room.spawnObjects();
        this._startMemorizePhase();
    }

    /**
     * Called when all 5 levels are completed.
     */
    _onGameComplete() {
        this.state = STATE.GAME_OVER;
        this.controls.setActive(false);
        this.sound.playGameOver();

        if (this.score > this.highScore) {
            this.highScore = this.score;
            this._saveHighScore(this.highScore);
            this.ui.updateHighScore(this.highScore);
        }

        // Show game over with "You Win!" message
        this.ui.goLevel.textContent = `${this.level} (COMPLETE!)`;
        this.ui.goScore.textContent = this.score;
        this.ui.goFound.textContent = this.totalChangesFound;
        const accuracy = this.totalAttempts > 0 ? Math.round((this.totalChangesFound / this.totalAttempts) * 100) : 0;
        this.ui.goAccuracy.textContent = `${accuracy}%`;
        this.ui.showMenu('gameover');
    }

    /**
     * Returns to the main menu.
     */
    _goToMainMenu() {
        this.state = STATE.MENU;
        this.controls.setActive(false);
        this.controls.reset();
        this.ui.showHUD(false);
        this.ui.showMenu('main');
        this.ui.updateHighScore(this.highScore);
    }

    /**
     * Main update loop — called every frame.
     * @param {number} delta - Time delta in seconds
     */
    update(delta) {
        // Update controls (movement, look)
        this.controls.update(delta);

        // Update feedback animations
        this._updateFeedbackAnimations(delta);

        // Update timers based on state
        if (this.state === STATE.MEMORIZE) {
            this.timeRemaining -= delta;
            this.ui.updateHUD(this.level, this.timeRemaining, this.score, this.lives, this.room.getTotalChanges());

            if (this.timeRemaining <= 0) {
                this._startChangeFlashPhase();
            }
        } else if (this.state === STATE.OBSERVE) {
            this.timeRemaining -= delta;
            this.ui.updateHUD(this.level, this.timeRemaining, this.score, this.lives, this.room.getRemainingChanges());

            // Tick sound when < 5s
            if (this.timeRemaining <= 5 && this.timeRemaining > 0 && Math.ceil(this.timeRemaining) !== Math.ceil(this.timeRemaining + delta)) {
                this.sound.playTick();
            }

            if (this.timeRemaining <= 0) {
                this._onGameOver();
            }
        }
    }

    /**
     * Loads the high score from localStorage.
     * @returns {number} The saved high score, or 0
     */
    _loadHighScore() {
        try {
            const saved = localStorage.getItem('changespotter_highscore');
            return saved ? parseInt(saved, 10) : 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Saves the high score to localStorage.
     * @param {number} score - Score to save
     */
    _saveHighScore(score) {
        try {
            localStorage.setItem('changespotter_highscore', score.toString());
        } catch (e) {
            // localStorage may not be available
        }
    }

    /**
     * Handles window resize.
     */
    resize() {
        this.ui.resize();
    }
}
