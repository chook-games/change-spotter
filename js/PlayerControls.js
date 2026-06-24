/**
 * PlayerControls.js — First-person controls for CHANGE SPOTTER
 * Supports both PC (WASD + mouse) and Mobile (dual virtual joysticks).
 * Handles movement, camera look, zoom mode, and raycasting for object selection.
 */

import * as THREE from 'three';
import { isTouchDevice, clamp, randomFloat } from './utils.js';

/** Movement speed in units per second */
const MOVE_SPEED = 3.0;
/** Mouse look sensitivity */
const MOUSE_SENSITIVITY = 0.002;
/** Joystick look sensitivity */
const JOYSTICK_SENSITIVITY = 0.03;
/** Default FOV */
const DEFAULT_FOV = 75;
/** Zoom FOV */
const ZOOM_FOV = 35;
/** Player height (eye level) */
const PLAYER_HEIGHT = 1.6;
/** Minimum pitch angle (radians) */
const MIN_PITCH = -Math.PI / 2.2;
/** Maximum pitch angle (radians) */
const MAX_PITCH = Math.PI / 2.2;

export class PlayerControls {
    /**
     * @param {THREE.Camera} camera - The Three.js camera
     * @param {HTMLElement} domElement - The renderer DOM element
     * @param {import('./UI.js').UI} ui - UI instance for zoom button state
     * @param {THREE.Scene} scene - The Three.js scene (for raycasting)
     */
    constructor(camera, domElement, ui, scene) {
        /** @type {THREE.Camera} */
        this.camera = camera;
        /** @type {HTMLElement} */
        this.domElement = domElement;
        /** @type {import('./UI.js').UI} */
        this.ui = ui;
        /** @type {THREE.Scene} */
        this.scene = scene;

        // Initial camera position
        this.camera.position.set(0, PLAYER_HEIGHT, 4);
        this.camera.fov = DEFAULT_FOV;
        this.camera.updateProjectionMatrix();

        // Euler angles for look direction
        /** @type {number} Yaw (left/right) */
        this.yaw = 0;
        /** @type {number} Pitch (up/down) */
        this.pitch = 0;

        // Movement state
        /** @type {{ forward: boolean, backward: boolean, left: boolean, right: boolean }} */
        this.keys = { forward: false, backward: false, left: false, right: false };

        // Zoom state
        /** @type {boolean} */
        this.isZoomed = false;

        // Pointer lock state (PC)
        /** @type {boolean} */
        this.isLocked = false;

        // Joystick state
        /** @type {{ x: number, y: number }} */
        this.moveJoystick = { x: 0, y: 0 };
        /** @type {{ x: number, y: number }} */
        this.lookJoystick = { x: 0, y: 0 };

        // Touch identifiers for multi-touch
        /** @type {number|null} */
        this.moveTouchId = null;
        /** @type {number|null} */
        this.lookTouchId = null;

        // Raycaster for object selection
        /** @type {THREE.Raycaster} */
        this.raycaster = new THREE.Raycaster();
        /** @type {THREE.Vector2} */
        this.mouse = new THREE.Vector2();

        // Callbacks
        /** @type {function|null} */
        this.onObjectSelected = null;

        // Is the game active (accepting input)?
        /** @type {boolean} */
        this.active = false;

        // Bind events
        this._bindKeyboard();
        this._bindMouse();
        this._bindTouch();
        this._bindZoomButton();

        // Initial FOV
        this._targetFov = DEFAULT_FOV;
    }

    /**
     * Activates or deactivates controls.
     * @param {boolean} active
     */
    setActive(active) {
        this.active = active;
        if (!active) {
            this.isZoomed = false;
            this.ui.setZoom(false);
            this._targetFov = DEFAULT_FOV;
            this.camera.fov = DEFAULT_FOV;
            this.camera.updateProjectionMatrix();
            // Reset joysticks
            this.moveJoystick = { x: 0, y: 0 };
            this.lookJoystick = { x: 0, y: 0 };
            this.keys = { forward: false, backward: false, left: false, right: false };
        }
    }

    /**
     * Teleports the camera to a random position in the room with random yaw.
     * Used during the fade-to-black transition between phases.
     */
    teleportRandom() {
        // Random position within room bounds (avoiding walls)
        const x = randomFloat(-4.0, 4.0);
        const z = randomFloat(-4.0, 4.0);
        this.camera.position.set(x, PLAYER_HEIGHT, z);

        // Random yaw (full 360 degrees)
        this.yaw = randomFloat(0, Math.PI * 2);
        this.pitch = randomFloat(-0.3, 0.3); // Slight random pitch

        // Apply rotation immediately
        const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(euler);
    }

    /**
     * Binds keyboard events (PC).
     */
    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (!this.active) return;
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.keys.forward = true; e.preventDefault(); break;
                case 'KeyS': case 'ArrowDown': this.keys.backward = true; e.preventDefault(); break;
                case 'KeyA': case 'ArrowLeft': this.keys.left = true; e.preventDefault(); break;
                case 'KeyD': case 'ArrowRight': this.keys.right = true; e.preventDefault(); break;
                case 'Space': // Space to toggle zoom
                    e.preventDefault();
                    this._toggleZoom();
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.keys.forward = false; e.preventDefault(); break;
                case 'KeyS': case 'ArrowDown': this.keys.backward = false; e.preventDefault(); break;
                case 'KeyA': case 'ArrowLeft': this.keys.left = false; e.preventDefault(); break;
                case 'KeyD': case 'ArrowRight': this.keys.right = false; e.preventDefault(); break;
            }
        });
    }

    /**
     * Binds mouse events (PC).
     */
    _bindMouse() {
        // Pointer lock for mouse look
        this.domElement.addEventListener('click', () => {
            if (!this.active || isTouchDevice()) return;
            if (!this.isLocked) {
                this.domElement.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.domElement;
        });

        // Mouse move for looking
        document.addEventListener('mousemove', (e) => {
            if (!this.active || !this.isLocked) return;
            this.yaw -= e.movementX * MOUSE_SENSITIVITY;
            this.pitch -= e.movementY * MOUSE_SENSITIVITY;
            this.pitch = clamp(this.pitch, MIN_PITCH, MAX_PITCH);
        });

        // Right-click for zoom toggle (PC)
        this.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!this.active) return;
            this._toggleZoom();
        });

        // Left-click for selection (PC) — only when zoomed and pointer is locked
        this.domElement.addEventListener('click', (e) => {
            if (!this.active || !this.isLocked) return;
            if (this.isZoomed) {
                this._performRaycast(e.clientX, e.clientY);
            }
        });
    }

    /**
     * Binds touch events for mobile virtual joysticks.
     * Events are bound to document to capture touches on joystick zones
     * (which are siblings of the game container in the DOM).
     */
    _bindTouch() {
        if (!isTouchDevice()) return;

        const jLeft = document.getElementById('joystick-left');
        const jRight = document.getElementById('joystick-right');
        const jkLeft = document.getElementById('jk-left');
        const jkRight = document.getElementById('jk-right');

        /**
         * Determines which joystick zone a touch point belongs to.
         * @param {number} clientX - Touch X coordinate
         * @param {number} clientY - Touch Y coordinate
         * @returns {'move'|'look'|null}
         */
        const getJoystickZone = (clientX, clientY) => {
            const el = document.elementFromPoint(clientX, clientY);
            if (el) {
                if (el.id === 'joystick-left' || el.closest('#joystick-left')) return 'move';
                if (el.id === 'joystick-right' || el.closest('#joystick-right')) return 'look';
            }
            return null;
        };

        const handleTouchStart = (e) => {
            if (!this.active) return;
            for (const touch of e.changedTouches) {
                const zone = getJoystickZone(touch.clientX, touch.clientY);
                if (zone === 'move' && this.moveTouchId === null) {
                    this.moveTouchId = touch.identifier;
                    this._updateJoystick(touch, 'move', jLeft, jkLeft);
                } else if (zone === 'look' && this.lookTouchId === null) {
                    this.lookTouchId = touch.identifier;
                    this._updateJoystick(touch, 'look', jRight, jkRight);
                }
            }
            e.preventDefault();
        };

        const handleTouchMove = (e) => {
            if (!this.active) return;
            for (const touch of e.changedTouches) {
                if (touch.identifier === this.moveTouchId) {
                    this._updateJoystick(touch, 'move', jLeft, jkLeft);
                } else if (touch.identifier === this.lookTouchId) {
                    this._updateJoystick(touch, 'look', jRight, jkRight);
                }
            }
            e.preventDefault();
        };

        const handleTouchEnd = (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === this.moveTouchId) {
                    this.moveTouchId = null;
                    this.moveJoystick = { x: 0, y: 0 };
                    jkLeft.style.transform = 'translate(-50%, -50%)';
                } else if (touch.identifier === this.lookTouchId) {
                    this.lookTouchId = null;
                    this.lookJoystick = { x: 0, y: 0 };
                    jkRight.style.transform = 'translate(-50%, -50%)';
                }
            }
            e.preventDefault();
        };

        // Tap on screen for selection when zoomed (mobile)
        const handleTap = (e) => {
            if (!this.active) return;
            if (this.isZoomed) {
                const touch = e.changedTouches[0];
                if (touch) {
                    this._performRaycast(touch.clientX, touch.clientY);
                }
            }
            e.preventDefault();
        };

        // Bind touch events on document to capture ALL touches
        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });
        document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

        // Handle taps on the HUD area for selection (when zoomed)
        document.getElementById('hud').addEventListener('touchstart', (e) => {
            const target = e.target;
            if (target && target.closest && !target.closest('#zoom-btn') && !target.closest('.joystick-zone')) {
                handleTap(e);
            }
        }, { passive: false });
    }

    /**
     * Updates a virtual joystick position based on touch.
     * @param {Touch} touch - The touch event
     * @param {'move'|'look'} type - Which joystick
     * @param {HTMLElement} zone - The joystick zone element
     * @param {HTMLElement} knob - The joystick knob element
     */
    _updateJoystick(touch, type, zone, knob) {
        const rect = zone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxRadius = rect.width / 2;

        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Clamp to zone radius
        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }

        // Normalise to -1..1
        const nx = dx / maxRadius;
        const ny = dy / maxRadius;

        // Update knob position
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        if (type === 'move') {
            this.moveJoystick = { x: nx, y: -ny }; // Invert Y so up = forward
        } else {
            this.lookJoystick = { x: nx, y: ny };
        }
    }

    /**
     * Binds the UI zoom button.
     */
    _bindZoomButton() {
        this.ui.onZoomToggle = (active) => {
            this.isZoomed = active;
            this._targetFov = active ? ZOOM_FOV : DEFAULT_FOV;
        };
    }

    /**
     * Toggles zoom mode.
     */
    _toggleZoom() {
        this.isZoomed = !this.isZoomed;
        this.ui.setZoom(this.isZoomed);
        this._targetFov = this.isZoomed ? ZOOM_FOV : DEFAULT_FOV;
    }

    /**
     * Performs a raycast from screen coordinates to select an object.
     * @param {number} screenX - Client X coordinate
     * @param {number} screenY - Client Y coordinate
     */
    _performRaycast(screenX, screenY) {
        // Convert to NDC
        this.mouse.x = (screenX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(screenY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Get all meshes in the scene that are game objects
        const meshes = [];
        this.scene.traverse((child) => {
            if (child.isMesh && child.userData.isGameObject) {
                meshes.push(child);
            }
        });

        const intersects = this.raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            if (this.onObjectSelected) {
                this.onObjectSelected(hit);
            }
        }
    }

    /**
     * Updates the camera position and rotation each frame.
     * @param {number} delta - Time delta in seconds
     */
    update(delta) {
        if (!this.active) return;

        // --- Movement ---
        // FIXED: A/D now correct. 'right' key maps to +X, 'left' key maps to -X
        const moveX = this.keys.right ? 1 : (this.keys.left ? -1 : this.moveJoystick.x);
        const moveZ = this.keys.forward ? 1 : (this.keys.backward ? -1 : this.moveJoystick.y);

        if (moveX !== 0 || moveZ !== 0) {
            // Calculate movement direction relative to camera yaw
            const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
            // FIXED: Right vector calculation — was (forward.z, 0, -forward.x) which was inverted
            const right = new THREE.Vector3(-forward.z, 0, forward.x);

            const moveVec = new THREE.Vector3()
                .addScaledVector(forward, moveZ)
                .addScaledVector(right, moveX)
                .normalize()
                .multiplyScalar(MOVE_SPEED * delta);

            this.camera.position.add(moveVec);

            // Keep within room bounds
            this.camera.position.x = clamp(this.camera.position.x, -5.5, 5.5);
            this.camera.position.z = clamp(this.camera.position.z, -5.5, 5.5);
            this.camera.position.y = PLAYER_HEIGHT; // Keep at eye level
        }

        // --- Look (joystick) ---
        if (this.lookJoystick.x !== 0 || this.lookJoystick.y !== 0) {
            this.yaw -= this.lookJoystick.x * JOYSTICK_SENSITIVITY;
            this.pitch -= this.lookJoystick.y * JOYSTICK_SENSITIVITY;
            this.pitch = clamp(this.pitch, MIN_PITCH, MAX_PITCH);
        }

        // --- Apply camera rotation ---
        const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(euler);

        // --- Smooth FOV transition ---
        const fovDiff = this._targetFov - this.camera.fov;
        if (Math.abs(fovDiff) > 0.1) {
            this.camera.fov += fovDiff * 0.1;
            this.camera.updateProjectionMatrix();
        } else {
            this.camera.fov = this._targetFov;
        }
    }

    /**
     * Gets the camera's forward direction (horizontal only).
     * @returns {THREE.Vector3}
     */
    getForwardDirection() {
        return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    }

    /**
     * Resets the camera to the starting position.
     */
    reset() {
        this.camera.position.set(0, PLAYER_HEIGHT, 4);
        this.yaw = 0;
        this.pitch = 0;
        this.isZoomed = false;
        this._targetFov = DEFAULT_FOV;
        this.camera.fov = DEFAULT_FOV;
        this.camera.updateProjectionMatrix();
        this.moveJoystick = { x: 0, y: 0 };
        this.lookJoystick = { x: 0, y: 0 };
        this.keys = { forward: false, backward: false, left: false, right: false };
    }
}
