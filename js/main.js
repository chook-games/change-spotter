/**
 * main.js — Entry point for CHANGE SPOTTER
 * Initialises Three.js renderer, scene, camera, and starts the game loop.
 * This is the bootstrap module loaded from index.html.
 */

import * as THREE from 'three';
import { Game } from './Game.js';

// ============================================================
// Three.js Setup
// ============================================================

/** @type {THREE.Scene} */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue (visible through window)
scene.fog = new THREE.Fog(0x87CEEB, 15, 25);

/** @type {THREE.PerspectiveCamera} */
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 4);
scene.add(camera); // Add camera to scene so parent traversal works

/** @type {THREE.WebGLRenderer} */
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap for performance
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Add renderer to DOM
const container = document.getElementById('game-container');
container.appendChild(renderer.domElement);

// ============================================================
// Lighting
// ============================================================

// Ambient light (soft fill)
const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
scene.add(ambientLight);

// Hemisphere light (sky/ground colour variation)
const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x8B6F47, 0.6);
scene.add(hemiLight);

// Directional light (main light with shadows)
const dirLight = new THREE.DirectionalLight(0xFFEECC, 1.2);
dirLight.position.set(5, 8, 3);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 20;
dirLight.shadow.camera.left = -8;
dirLight.shadow.camera.right = 8;
dirLight.shadow.camera.top = 8;
dirLight.shadow.camera.bottom = -8;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

// Fill light from the window side
const fillLight = new THREE.DirectionalLight(0x8888FF, 0.3);
fillLight.position.set(-3, 4, 6);
scene.add(fillLight);

// ============================================================
// Game Initialisation
// ============================================================

/** @type {Game} */
const game = new Game(scene, camera, renderer.domElement);

// ============================================================
// Game Loop
// ============================================================

/** @type {number} */
let lastTime = 0;

/**
 * Main animation loop.
 * @param {number} time - Current timestamp from requestAnimationFrame
 */
function animate(time) {
    requestAnimationFrame(animate);

    // Calculate delta time in seconds
    const delta = Math.min((time - lastTime) / 1000, 0.05); // Cap at 50ms to prevent jumps
    lastTime = time;

    // Update game logic
    game.update(delta);

    // Render scene
    renderer.render(scene, camera);
}

// Start the loop
animate(0);

// ============================================================
// Window Resize Handler
// ============================================================

/**
 * Handles window resize events to keep the canvas properly sized.
 */
function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

    game.resize();
}

window.addEventListener('resize', onResize);

// Handle orientation change on mobile
window.addEventListener('orientationchange', () => {
    setTimeout(onResize, 300);
});

// ============================================================
// Prevent default touch behaviours
// ============================================================

document.addEventListener('touchmove', (e) => {
    // Only prevent on canvas/game-container, not on menus or HUD buttons
    if (e.target === renderer.domElement) {
        e.preventDefault();
    } else if (e.target.closest && e.target.closest('#game-container') && !e.target.closest('.menu') && !e.target.closest('#hud')) {
        e.preventDefault();
    }
}, { passive: false });


// Prevent pull-to-refresh on mobile — only on the game canvas, not on menus/buttons
document.body.addEventListener('touchstart', (e) => {
    // Only prevent on the canvas itself or game container, not on UI elements
    if (e.target === renderer.domElement) {
        e.preventDefault();
    } else if (e.target.closest && e.target.closest('#game-container') && !e.target.closest('.menu') && !e.target.closest('#hud')) {
        e.preventDefault();
    }
}, { passive: false });


// ============================================================
// Console info
// ============================================================

console.log('🏠 CHANGE SPOTTER — 3D Memory Challenge');
console.log('📖 Controls: WASD + Mouse (PC) | Dual Joysticks (Mobile)');
console.log('🔍 Press Space / Right-click to toggle zoom for selection');
