/**
 * UI.js — User Interface management for CHANGE SPOTTER
 * Handles all DOM overlays: HUD, menus, effects, confetti.
 */

import { isTouchDevice } from './utils.js';

export class UI {
    constructor(soundManager) {
        /** @type {import('./SoundManager.js').SoundManager} */
        this.sound = soundManager;

        // Cache DOM references
        /** @type {HTMLElement} */
        this.hud = document.getElementById('hud');
        /** @type {HTMLElement} */
        this.levelDisplay = document.getElementById('level-display');
        /** @type {HTMLElement} */
        this.timerDisplay = document.getElementById('timer-display');
        /** @type {HTMLElement} */
        this.scoreDisplay = document.getElementById('score-display');
        /** @type {HTMLElement} */
        this.livesDisplay = document.getElementById('lives-display');
        /** @type {HTMLElement} */
        this.changesLeft = document.getElementById('changes-left');
        /** @type {HTMLElement} */
        this.zoomBtn = document.getElementById('zoom-btn');
        /** @type {HTMLElement} */
        this.crosshair = document.getElementById('crosshair');

        // Joysticks
        /** @type {HTMLElement} */
        this.joystickLeft = document.getElementById('joystick-left');
        /** @type {HTMLElement} */
        this.joystickRight = document.getElementById('joystick-right');
        /** @type {HTMLElement} */
        this.jkLeft = document.getElementById('jk-left');
        /** @type {HTMLElement} */
        this.jkRight = document.getElementById('jk-right');

        // Menus
        /** @type {HTMLElement} */
        this.menuMain = document.getElementById('menu-main');
        /** @type {HTMLElement} */
        this.menuHowToPlay = document.getElementById('menu-howtoplay');
        /** @type {HTMLElement} */
        this.menuGameOver = document.getElementById('menu-gameover');
        /** @type {HTMLElement} */
        this.menuLevelComplete = document.getElementById('menu-levelcomplete');

        // Menu elements
        /** @type {HTMLElement} */
        this.highScoreValue = document.getElementById('hs-value');
        /** @type {HTMLElement} */
        this.goLevel = document.getElementById('go-level');
        /** @type {HTMLElement} */
        this.goScore = document.getElementById('go-score');
        /** @type {HTMLElement} */
        this.goFound = document.getElementById('go-found');
        /** @type {HTMLElement} */
        this.goAccuracy = document.getElementById('go-accuracy');
        /** @type {HTMLElement} */
        this.lcScore = document.getElementById('lc-score');
        /** @type {HTMLElement} */
        this.lcBonus = document.getElementById('lc-bonus');

        // Flash overlays
        /** @type {HTMLElement} */
        this.flashWhiteEl = document.getElementById('flash-white');
        /** @type {HTMLElement} */
        this.flashRedEl = document.getElementById('flash-red');

        // Fade overlay (for teleport transition)
        /** @type {HTMLElement} */
        this.fadeBlackEl = document.getElementById('fade-black');

        // Confetti canvas
        /** @type {HTMLCanvasElement} */
        this.confettiCanvas = document.getElementById('confetti-canvas');
        /** @type {CanvasRenderingContext2D} */
        this.confettiCtx = this.confettiCanvas.getContext('2d');

        // Confetti state
        /** @type {Array<{x: number, y: number, vx: number, vy: number, size: number, color: string, rotation: number, rotSpeed: number}>} */
        this.confettiParticles = [];
        /** @type {boolean} */
        this.confettiActive = false;

        // Callbacks (set by Game)
        /** @type {function} */
        this.onStartGame = null;
        /** @type {function} */
        this.onNextLevel = null;
        /** @type {function} */
        this.onRetry = null;
        /** @type {function} */
        this.onMainMenu = null;
        /** @type {function} */
        this.onZoomToggle = null;

        // Bind events
        this._bindMenuEvents();
        this._bindZoomButton();
    }

    /**
     * Binds menu button click events.
     */
    _bindMenuEvents() {
        document.getElementById('btn-start').addEventListener('click', () => {
            this.sound.playClick();
            if (this.onStartGame) this.onStartGame();
        });
        document.getElementById('btn-howtoplay').addEventListener('click', () => {
            this.sound.playClick();
            this.showMenu('howtoplay');
        });
        document.getElementById('btn-back-main').addEventListener('click', () => {
            this.sound.playClick();
            this.showMenu('main');
        });
        document.getElementById('btn-retry').addEventListener('click', () => {
            this.sound.playClick();
            if (this.onRetry) this.onRetry();
        });
        document.getElementById('btn-menu').addEventListener('click', () => {
            this.sound.playClick();
            if (this.onMainMenu) this.onMainMenu();
        });
        document.getElementById('btn-next-level').addEventListener('click', () => {
            this.sound.playClick();
            if (this.onNextLevel) this.onNextLevel();
        });
    }

    /**
     * Binds the zoom toggle button.
     */
    _bindZoomButton() {
        this.zoomBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sound.playClick();
            this.toggleZoom();
        });
    }

    /**
     * Toggles zoom mode on/off.
     */
    toggleZoom() {
        const isActive = this.zoomBtn.classList.toggle('active');
        this.crosshair.classList.toggle('hidden', !isActive);
        if (this.onZoomToggle) this.onZoomToggle(isActive);
        return isActive;
    }

    /**
     * Sets zoom state externally.
     * @param {boolean} active
     */
    setZoom(active) {
        this.zoomBtn.classList.toggle('active', active);
        this.crosshair.classList.toggle('hidden', !active);
    }

    /**
     * Shows a specific menu and hides others.
     * @param {'main'|'howtoplay'|'gameover'|'levelcomplete'|'none'} menu - Menu to show, or 'none' to hide all
     */
    showMenu(menu) {
        // Hide all menus
        this.menuMain.classList.add('hidden');
        this.menuHowToPlay.classList.add('hidden');
        this.menuGameOver.classList.add('hidden');
        this.menuLevelComplete.classList.add('hidden');

        // Show requested menu
        switch (menu) {
            case 'main':
                this.menuMain.classList.remove('hidden');
                break;
            case 'howtoplay':
                this.menuHowToPlay.classList.remove('hidden');
                break;
            case 'gameover':
                this.menuGameOver.classList.remove('hidden');
                break;
            case 'levelcomplete':
                this.menuLevelComplete.classList.remove('hidden');
                break;
            case 'none':
                break;
        }
    }

    /**
     * Shows or hides the HUD and joysticks.
     * @param {boolean} visible
     */
    showHUD(visible) {
        this.hud.classList.toggle('hidden', !visible);
        if (isTouchDevice()) {
            this.joystickLeft.classList.toggle('hidden', !visible);
            this.joystickRight.classList.toggle('hidden', !visible);
        }
    }

    /**
     * Updates the HUD display values.
     * @param {number} level - Current level number
     * @param {number} time - Remaining time in seconds
     * @param {number} score - Current score
     * @param {number} lives - Remaining lives
     * @param {number} changesRemaining - Number of changes still to find
     */
    updateHUD(level, time, score, lives, changesRemaining) {
        this.levelDisplay.textContent = `LEVEL ${level}`;
        this.timerDisplay.textContent = Math.ceil(time);
        this.scoreDisplay.textContent = score;
        this.livesDisplay.textContent = '♥'.repeat(Math.max(0, lives));
        this.changesLeft.textContent = `Find ${changesRemaining} change${changesRemaining !== 1 ? 's' : ''} left`;

        // Timer warning
        this.timerDisplay.classList.toggle('warning', time <= 5 && time > 0);
    }

    /**
     * Shows the game over screen with stats.
     * @param {number} level - Level reached
     * @param {number} score - Final score
     * @param {number} changesFound - Total changes found
     * @param {number} totalAttempts - Total selection attempts
     */
    showGameOver(level, score, changesFound, totalAttempts) {
        this.goLevel.textContent = level;
        this.goScore.textContent = score;
        this.goFound.textContent = changesFound;
        const accuracy = totalAttempts > 0 ? Math.round((changesFound / totalAttempts) * 100) : 0;
        this.goAccuracy.textContent = `${accuracy}%`;
        this.showMenu('gameover');
    }

    /**
     * Shows the level complete screen.
     * @param {number} score - Score after level
     * @param {number} bonus - Time bonus points
     */
    showLevelComplete(score, bonus) {
        this.lcScore.textContent = score;
        this.lcBonus.textContent = bonus;
        this.showMenu('levelcomplete');
    }

    /**
     * Updates the high score display.
     * @param {number} score - High score value
     */
    updateHighScore(score) {
        this.highScoreValue.textContent = score;
    }

    /**
     * Flashes the white overlay (for change phase).
     */
    flashWhite() {
        this.flashWhiteEl.classList.add('active');
        setTimeout(() => {
            this.flashWhiteEl.classList.remove('active');
        }, 300);
    }

    /**
     * Flashes the red overlay (for wrong selection).
     */
    flashRed() {
        this.flashRedEl.classList.add('active');
        setTimeout(() => {
            this.flashRedEl.classList.remove('active');
        }, 200);
    }

    /**
     * Fades the screen to black over a duration.
     * @param {number} duration - Fade duration in ms
     * @returns {Promise<void>} Resolves when fade is complete
     */
    fadeToBlack(duration = 1500) {
        return new Promise((resolve) => {
            this.fadeBlackEl.style.transition = `opacity ${duration}ms ease-in`;
            this.fadeBlackEl.classList.add('active');
            setTimeout(resolve, duration);
        });
    }

    /**
     * Fades from black back to the game view.
     * @param {number} duration - Fade duration in ms
     * @returns {Promise<void>} Resolves when fade is complete
     */
    fadeFromBlack(duration = 500) {
        return new Promise((resolve) => {
            this.fadeBlackEl.style.transition = `opacity ${duration}ms ease-out`;
            this.fadeBlackEl.classList.remove('active');
            setTimeout(resolve, duration);
        });
    }

    /**
     * Shakes the hearts display.
     */
    shakeHearts() {
        this.livesDisplay.classList.remove('shake');
        // Force reflow to restart animation
        void this.livesDisplay.offsetWidth;
        this.livesDisplay.classList.add('shake');
    }

    /**
     * Starts the confetti particle effect.
     */
    startConfetti() {
        this.confettiParticles = [];
        const colors = ['#ffcc00', '#ff4466', '#00ff88', '#4488ff', '#ff8800', '#cc44ff', '#44ffcc'];
        for (let i = 0; i < 150; i++) {
            this.confettiParticles.push({
                x: Math.random() * this.confettiCanvas.width,
                y: -20 - Math.random() * 200,
                vx: (Math.random() - 0.5) * 6,
                vy: Math.random() * 3 + 2,
                size: 4 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10
            });
        }
        this.confettiActive = true;
        this._animateConfetti();
    }

    /**
     * Animates confetti particles.
     */
    _animateConfetti() {
        if (!this.confettiActive) return;

        const ctx = this.confettiCtx;
        const canvas = this.confettiCanvas;

        // Match canvas size to window
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let alive = false;
        for (const p of this.confettiParticles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // gravity
            p.rotation += p.rotSpeed;

            if (p.y < canvas.height + 20) {
                alive = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                ctx.restore();
            }
        }

        if (alive) {
            requestAnimationFrame(() => this._animateConfetti());
        } else {
            this.confettiActive = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    /**
     * Resizes the confetti canvas.
     */
    resize() {
        this.confettiCanvas.width = window.innerWidth;
        this.confettiCanvas.height = window.innerHeight;
    }
}
