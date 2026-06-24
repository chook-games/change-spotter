/**
 * SoundManager.js — Procedural audio for CHANGE SPOTTER
 * Uses the Web Audio API to generate all sounds programmatically.
 * No external audio files needed.
 */

export class SoundManager {
    constructor() {
        /** @type {AudioContext|null} */
        this.ctx = null;
        /** @type {boolean} */
        this.initialised = false;
        /** @type {number} Master volume (0-1) */
        this.volume = 0.3;
    }

    /**
     * Initialises the AudioContext.
     * Must be called from a user gesture (click/tap) due to browser autoplay policy.
     */
    init() {
        if (this.initialised) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialised = true;
        } catch (e) {
            console.warn('Web Audio API not available:', e);
        }
    }

    /**
     * Ensures the AudioContext is resumed (for browsers that suspend it).
     */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Plays a tone with given parameters.
     * @param {number} frequency - Frequency in Hz
     * @param {string} type - Oscillator type (sine, square, triangle, sawtooth)
     * @param {number} duration - Duration in seconds
     * @param {number} [volume=1] - Volume multiplier for this sound
     * @param {number} [startTime=0] - Delay before playing
     * @returns {OscillatorNode|null} The oscillator node (or null if failed)
     */
    _playTone(frequency, type, duration, volume = 1, startTime = 0) {
        if (!this.ctx) return null;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(frequency, this.ctx.currentTime + startTime);
            gain.gain.setValueAtTime(this.volume * volume, this.ctx.currentTime + startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + startTime);
            osc.stop(this.ctx.currentTime + startTime + duration);
            return osc;
        } catch (e) {
            return null;
        }
    }

    /**
     * Plays a short happy chime for correct selection.
     * Ascending arpeggio: C5 → E5 → G5
     */
    playCorrect() {
        this.resume();
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, i) => {
            this._playTone(freq, 'sine', 0.15, 0.8, i * 0.08);
        });
    }

    /**
     * Plays a low buzz for wrong selection.
     */
    playWrong() {
        this.resume();
        this._playTone(150, 'square', 0.25, 0.6);
        this._playTone(120, 'sawtooth', 0.2, 0.3);
    }

    /**
     * Plays a victory fanfare for level completion.
     * Major chord arpeggio with longer notes.
     */
    playLevelComplete() {
        this.resume();
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            this._playTone(freq, 'sine', 0.3, 0.7, i * 0.12);
        });
        // Add a harmony layer
        notes.forEach((freq, i) => {
            this._playTone(freq / 2, 'triangle', 0.5, 0.3, i * 0.12);
        });
    }

    /**
     * Plays a sad descending tone for game over.
     */
    playGameOver() {
        this.resume();
        const notes = [523.25, 392.0, 261.63, 196.0]; // C5 → G4 → C4 → G3
        notes.forEach((freq, i) => {
            this._playTone(freq, 'sine', 0.4, 0.6, i * 0.2);
        });
        // Low rumble
        this._playTone(65.41, 'sawtooth', 1.0, 0.2); // C2
    }

    /**
     * Plays a tick sound for timer warning.
     */
    playTick() {
        this.resume();
        this._playTone(800, 'sine', 0.05, 0.4);
    }

    /**
     * Plays a short click for UI button presses.
     */
    playClick() {
        this.resume();
        this._playTone(600, 'square', 0.03, 0.2);
    }

    /**
     * Plays a swoosh sound for the change phase flash.
     */
    playChangeFlash() {
        this.resume();
        if (!this.ctx) return;
        try {
            // White noise burst
            const bufferSize = this.ctx.sampleRate * 0.15;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(this.volume * 0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
            source.connect(gain);
            gain.connect(this.ctx.destination);
            source.start();
        } catch (e) {
            // Fallback to simple tone
            this._playTone(2000, 'sine', 0.1, 0.2);
        }
    }
}
