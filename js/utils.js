/**
 * utils.js — Helper utilities for CHANGE SPOTTER
 * Provides random number generators, colour helpers, and math utilities.
 */

/**
 * Returns a random integer between min and max (inclusive).
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random float between min and max.
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random float
 */
export function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Linear interpolation between a and b by t.
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Clamp a value between min and max.
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum bound
 * @param {number} max - Maximum bound
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Generates a random vibrant colour as a hex string.
 * @returns {string} Hex colour string (e.g. "#FF5733")
 */
export function randomColor() {
    const hue = Math.random() * 360;
    return hslToHex(hue, 70 + Math.random() * 30, 50 + Math.random() * 20);
}

/**
 * Converts HSL to hex string.
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex colour string
 */
export function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1);
    const toHex = x => Math.round(255 * f(x)).toString(16).padStart(2, '0');
    return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

/**
 * Converts a hex colour string to a Three.js Color-compatible object.
 * @param {string} hex - Hex colour string
 * @returns {{ r: number, g: number, b: number }} RGB object with 0-1 values
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 1, g: 1, b: 1 };
}

/**
 * Picks a random element from an array.
 * @param {Array} arr - The array to pick from
 * @returns {*} A random element
 */
export function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 * @param {Array} arr - Array to shuffle
 * @returns {Array} The shuffled array
 */
export function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Generates a unique ID for game objects.
 * @returns {string} Unique ID
 */
let _idCounter = 0;
export function generateId() {
    return `obj_${++_idCounter}_${Date.now()}`;
}

/**
 * Checks if device is likely mobile/touch-based.
 * @returns {boolean} True if touch device
 */
export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
