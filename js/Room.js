/**
 * Room.js — Builds the 3D living room environment for CHANGE SPOTTER
 * Creates walls, floor, ceiling, furniture, and decorative objects.
 * Handles spawning objects and applying random changes.
 */

import * as THREE from 'three';
import { randomInt, randomFloat, randomPick, shuffle, generateId, hslToHex } from './utils.js';

// Room dimensions
const ROOM_W = 12;  // width (X axis)
const ROOM_D = 12;  // depth (Z axis)
const ROOM_H = 3.5; // height (Y axis)

// Object placement bounds (avoiding walls)
const MIN_X = -4.5;
const MAX_X = 4.5;
const MIN_Z = -4.5;
const MAX_Z = 4.5;

export class Room {
    constructor(scene) {
        /** @type {THREE.Scene} */
        this.scene = scene;

        /** @type {THREE.Group} */
        this.roomGroup = new THREE.Group();

        /** @type {Array<{id: string, mesh: THREE.Mesh, originalPos: THREE.Vector3, originalColor: string, changed: boolean, found: boolean, changeType: string|null}>} */
        this.objects = [];

        /** @type {Array<THREE.Mesh>} */
        this.furniture = [];

        /** @type {number} Current level */
        this.level = 1;

        /** @type {number} Number of changes to apply */
        this.changeCount = 0;

        /** @type {Array} References to objects that changed */
        this.changedObjects = [];

        // Build the room
        this._buildRoom();
        this._buildFurniture();
    }

    /**
     * Builds the room shell: floor, walls, ceiling.
     */
    _buildRoom() {
        // --- Floor (wooden look) ---
        const floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x8B6F47,
            roughness: 0.8,
            metalness: 0.1,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.roomGroup.add(floor);

        // Floor grid lines (subtle)
        const gridHelper = new THREE.GridHelper(ROOM_W, 12, 0x6B4F2F, 0x6B4F2F);
        gridHelper.position.y = 0.01;
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.15;
        this.roomGroup.add(gridHelper);

        // --- Walls ---
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0xE8DCC8,
            roughness: 0.9,
            metalness: 0.0,
        });

        const wallHeight = ROOM_H;
        const wallThick = 0.2;

        // Back wall (Z negative)
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, wallHeight, wallThick), wallMat);
        backWall.position.set(0, wallHeight / 2, -ROOM_D / 2);
        backWall.receiveShadow = true;
        backWall.castShadow = true;
        this.roomGroup.add(backWall);

        // Front wall (Z positive) — with window opening
        const frontWall = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, wallHeight, wallThick), wallMat);
        frontWall.position.set(0, wallHeight / 2, ROOM_D / 2);
        frontWall.receiveShadow = true;
        frontWall.castShadow = true;
        this.roomGroup.add(frontWall);

        // Left wall (X negative)
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, ROOM_D), wallMat);
        leftWall.position.set(-ROOM_W / 2, wallHeight / 2, 0);
        leftWall.receiveShadow = true;
        leftWall.castShadow = true;
        this.roomGroup.add(leftWall);

        // Right wall (X positive)
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, ROOM_D), wallMat);
        rightWall.position.set(ROOM_W / 2, wallHeight / 2, 0);
        rightWall.receiveShadow = true;
        rightWall.castShadow = true;
        this.roomGroup.add(rightWall);

        // --- Ceiling ---
        const ceilMat = new THREE.MeshStandardMaterial({
            color: 0xF5F0E8,
            roughness: 0.9,
            metalness: 0.0,
        });
        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), ceilMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = ROOM_H;
        this.roomGroup.add(ceiling);

        // --- Baseboard (trim) ---
        const trimMat = new THREE.MeshStandardMaterial({ color: 0x6B4F2F, roughness: 0.7 });
        const trimH = 0.15;
        const trimD = 0.1;
        const addTrim = (x, y, z, sx, sy, sz) => {
            const t = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), trimMat);
            t.position.set(x, y, z);
            this.roomGroup.add(t);
        };
        // Move trim slightly inward from walls to avoid z-fighting
        // Wall inner surface is at ROOM_D/2 - wallThick/2 = 5.9, so place trim at 5.85
        const trimInset = 0.05;
        addTrim(0, trimH / 2, -ROOM_D / 2 + trimD / 2 + trimInset, ROOM_W - 0.2, trimH, trimD);
        addTrim(0, trimH / 2, ROOM_D / 2 - trimD / 2 - trimInset, ROOM_W - 0.2, trimH, trimD);
        addTrim(-ROOM_W / 2 + trimD / 2 + trimInset, trimH / 2, 0, trimD, trimH, ROOM_D - 0.2);
        addTrim(ROOM_W / 2 - trimD / 2 - trimInset, trimH / 2, 0, trimD, trimH, ROOM_D - 0.2);

        // --- Window (decorative frame on front wall) ---
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.6 });
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x87CEEB,
            transparent: true,
            opacity: 0.3,
            roughness: 0.1,
            metalness: 0.3,
        });
        const winW = 2.5;
        const winH = 2.0;
        const winY = 1.8;
        const winZ = ROOM_D / 2 - 0.15;

        // Window frame (4 sides)
        const frameW = 0.1;
        // Top
        const ft = new THREE.Mesh(new THREE.BoxGeometry(winW + frameW * 2, frameW, 0.1), frameMat);
        ft.position.set(0, winY + winH / 2, winZ);
        this.roomGroup.add(ft);
        // Bottom
        const fb = new THREE.Mesh(new THREE.BoxGeometry(winW + frameW * 2, frameW, 0.1), frameMat);
        fb.position.set(0, winY - winH / 2, winZ);
        this.roomGroup.add(fb);
        // Left
        const fl = new THREE.Mesh(new THREE.BoxGeometry(frameW, winH, 0.1), frameMat);
        fl.position.set(-winW / 2 - frameW / 2, winY, winZ);
        this.roomGroup.add(fl);
        // Right
        const fr = new THREE.Mesh(new THREE.BoxGeometry(frameW, winH, 0.1), frameMat);
        fr.position.set(winW / 2 + frameW / 2, winY, winZ);
        this.roomGroup.add(fr);
        // Glass pane
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
        glass.position.set(0, winY, winZ + 0.05);
        this.roomGroup.add(glass);

        // --- Picture frame on back wall ---
        const picMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const picCanvas = new THREE.MeshStandardMaterial({ color: 0x4A7C59 });
        const pic = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.05), picMat);
        pic.position.set(1.5, 2.0, -ROOM_D / 2 + 0.15);
        this.roomGroup.add(pic);
        const picInner = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), picCanvas);
        picInner.position.set(1.5, 2.0, -ROOM_D / 2 + 0.18);
        this.roomGroup.add(picInner);

        // --- Rug on floor ---
        const rugMat = new THREE.MeshStandardMaterial({
            color: 0x8B0000,
            roughness: 0.95,
        });
        const rug = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), rugMat);
        rug.rotation.x = -Math.PI / 2;
        rug.position.set(0, 0.02, 0);
        this.roomGroup.add(rug);

        // Add room group to scene
        this.scene.add(this.roomGroup);
    }

    /**
     * Builds furniture pieces (sofa, coffee table, bookshelf, lamp).
     */
    _buildFurniture() {
        // --- Sofa (couch) ---
        const sofaGroup = new THREE.Group();
        const sofaMat = new THREE.MeshStandardMaterial({ color: 0x4A7C59, roughness: 0.8 });
        const sofaDark = new THREE.MeshStandardMaterial({ color: 0x3A6C49, roughness: 0.8 });

        // Seat
        const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.8), sofaMat);
        seat.position.set(0, 0.25, 0);
        seat.castShadow = true;
        seat.receiveShadow = true;
        sofaGroup.add(seat);

        // Back
        const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.2), sofaDark);
        back.position.set(0, 0.55, -0.45);
        back.castShadow = true;
        sofaGroup.add(back);

        // Left arm
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.8), sofaDark);
        armL.position.set(-1.0, 0.2, 0);
        sofaGroup.add(armL);

        // Right arm
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.8), sofaDark);
        armR.position.set(1.0, 0.2, 0);
        sofaGroup.add(armR);

        // Legs
        const legMat = new THREE.MeshStandardMaterial({ color: 0x3C2415 });
        for (let x of [-0.8, 0.8]) {
            for (let z of [-0.3, 0.3]) {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 6), legMat);
                leg.position.set(x, -0.05, z);
                sofaGroup.add(leg);
            }
        }

        sofaGroup.position.set(-2.5, 0, -2.5);
        sofaGroup.rotation.y = 0.3;
        this.scene.add(sofaGroup);
        this.furniture.push(sofaGroup);

        // --- Coffee Table ---
        const tableGroup = new THREE.Group();
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.6 });
        const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.8), tableMat);
        tableTop.position.set(0, 0.5, 0);
        tableTop.castShadow = true;
        tableTop.receiveShadow = true;
        tableGroup.add(tableTop);

        // Legs
        for (let x of [-0.5, 0.5]) {
            for (let z of [-0.3, 0.3]) {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), tableMat);
                leg.position.set(x, 0.225, z);
                tableGroup.add(leg);
            }
        }

        tableGroup.position.set(0.5, 0, 0.5);
        this.scene.add(tableGroup);
        this.furniture.push(tableGroup);

        // --- Floor Lamp ---
        const lampGroup = new THREE.Group();
        const lampMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
        const lampShade = new THREE.MeshStandardMaterial({ color: 0xFFE4B5, roughness: 0.7 });

        // Pole
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), lampMat);
        pole.position.set(0, 0.9, 0);
        pole.castShadow = true;
        lampGroup.add(pole);

        // Base
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.05, 8), lampMat);
        base.position.set(0, 0.025, 0);
        lampGroup.add(base);

        // Shade (cone)
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 12), lampShade);
        shade.position.set(0, 1.9, 0);
        shade.castShadow = true;
        lampGroup.add(shade);

        // Light bulb glow (small sphere)
        const bulbMat = new THREE.MeshStandardMaterial({
            color: 0xFFDD88,
            emissive: 0xFFDD88,
            emissiveIntensity: 0.3,
        });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), bulbMat);
        bulb.position.set(0, 1.7, 0);
        lampGroup.add(bulb);

        lampGroup.position.set(3.0, 0, -2.0);
        this.scene.add(lampGroup);
        this.furniture.push(lampGroup);

        // --- Bookshelf ---
        const shelfGroup = new THREE.Group();
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 0.7 });
        const shelfWood = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.6 });

        // Sides
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.4), shelfMat);
        sideL.position.set(-0.4, 0.9, 0);
        shelfGroup.add(sideL);
        const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.4), shelfMat);
        sideR.position.set(0.4, 0.9, 0);
        shelfGroup.add(sideR);

        // Shelves
        for (let i = 0; i < 4; i++) {
            const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.4), shelfWood);
            shelf.position.set(0, i * 0.45 + 0.22, 0);
            shelfGroup.add(shelf);
        }

        // Some books (coloured boxes on shelves)
        const bookColors = [0xCC3333, 0x3366CC, 0x33AA55, 0xCC8833, 0x8833CC];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 2; j++) {
                const bookMat = new THREE.MeshStandardMaterial({
                    color: bookColors[(i + j) % bookColors.length],
                });
                const book = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25 + Math.random() * 0.15, 0.15), bookMat);
                book.position.set(-0.25 + j * 0.35, i * 0.45 + 0.4, 0.1);
                shelfGroup.add(book);
            }
        }

        shelfGroup.position.set(-3.0, 0, 2.5);
        shelfGroup.rotation.y = -0.2;
        this.scene.add(shelfGroup);
        this.furniture.push(shelfGroup);
    }

    /**
     * Creates the 5 decorative objects for the current level.
     * Objects are placed on the coffee table and around the room.
     */
    spawnObjects() {
        // Remove previous objects
        this._clearObjects();

        // Define 5 distinct objects with geometries and colours
        const objectDefs = [
            { name: 'Vase', geo: () => new THREE.CylinderGeometry(0.15, 0.2, 0.35, 12), color: 0xCC4466, pos: new THREE.Vector3(0.5, 0.7, 0.5) },
            { name: 'Candle', geo: () => new THREE.CylinderGeometry(0.06, 0.07, 0.2, 10), color: 0xFFE4B5, pos: new THREE.Vector3(0.2, 0.6, 0.7) },
            { name: 'Plant Pot', geo: () => new THREE.CylinderGeometry(0.12, 0.15, 0.2, 10), color: 0xCC6633, pos: new THREE.Vector3(0.8, 0.6, 0.3) },
            { name: 'Book Stack', geo: () => new THREE.BoxGeometry(0.2, 0.12, 0.25), color: 0x3366CC, pos: new THREE.Vector3(-0.1, 0.56, 0.5) },
            { name: 'Ornament', geo: () => new THREE.SphereGeometry(0.1, 10, 10), color: 0xFFAA00, pos: new THREE.Vector3(0.5, 0.58, 0.8) },
        ];

        // Place objects — some on coffee table, some around room
        const positions = [
            // On coffee table (relative to table at (0.5, 0, 0.5))
            new THREE.Vector3(0.5, 0.7, 0.5),
            new THREE.Vector3(0.2, 0.6, 0.7),
            new THREE.Vector3(0.8, 0.6, 0.3),
            new THREE.Vector3(-0.1, 0.56, 0.5),
            new THREE.Vector3(0.5, 0.58, 0.8),
        ];

        // Alternative positions around the room (for variety / changes)
        this._altPositions = [
            new THREE.Vector3(-1.5, 0.4, 1.0),
            new THREE.Vector3(2.0, 0.3, 1.5),
            new THREE.Vector3(-2.0, 0.35, -1.0),
            new THREE.Vector3(1.5, 0.25, -1.5),
            new THREE.Vector3(0.0, 0.3, -0.5),
            new THREE.Vector3(-1.0, 0.4, -2.0),
            new THREE.Vector3(2.5, 0.3, 0.0),
            new THREE.Vector3(-2.5, 0.35, 0.5),
        ];

        // Create each object
        objectDefs.forEach((def, i) => {
            const geo = def.geo();
            const mat = new THREE.MeshStandardMaterial({
                color: def.color,
                roughness: 0.5,
                metalness: 0.2,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(positions[i]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.isGameObject = true;

            // Random slight rotation
            mesh.rotation.y = Math.random() * Math.PI * 2;

            this.scene.add(mesh);

            this.objects.push({
                id: generateId(),
                name: def.name,
                mesh: mesh,
                originalPos: positions[i].clone(),
                originalColor: '#' + def.color.toString(16).padStart(6, '0'),
                currentPos: positions[i].clone(),
                currentColor: '#' + def.color.toString(16).padStart(6, '0'),
                changed: false,
                found: false,
                changeType: null,
            });
        });
    }

    /**
     * Removes all spawned objects from the scene.
     */
    _clearObjects() {
        for (const obj of this.objects) {
            this.scene.remove(obj.mesh);
            obj.mesh.geometry.dispose();
            obj.mesh.material.dispose();
        }
        this.objects = [];
        this.changedObjects = [];
    }

    /**
     * Applies random changes to objects for the current level.
     * @param {number} level - Current level (determines how many changes)
     * @returns {Array<{id: string, name: string, changeType: string}>} List of changed objects
     */
    applyChanges(level) {
        this.level = level;
        this.changeCount = Math.min(level, this.objects.length);

        // Reset all objects
        for (const obj of this.objects) {
            obj.changed = false;
            obj.found = false;
            obj.changeType = null;
            // Restore original position and colour
            obj.mesh.position.copy(obj.originalPos);
            obj.mesh.material.color.set(obj.originalColor);
            obj.mesh.material.opacity = 1;
            obj.mesh.material.transparent = false;
            obj.mesh.scale.set(1, 1, 1);
            obj.currentPos.copy(obj.originalPos);
            obj.currentColor = obj.originalColor;
        }

        // Pick random objects to change
        const candidates = shuffle([...this.objects]);
        const toChange = candidates.slice(0, this.changeCount);
        this.changedObjects = toChange;

        for (const obj of toChange) {
            // Randomly choose position change or colour change
            const changeType = Math.random() < 0.5 ? 'position' : 'colour';
            obj.changeType = changeType;
            obj.changed = true;

            if (changeType === 'position') {
                // Move to a random alternative position
                const altPos = randomPick(this._altPositions);
                // Add some randomness to avoid exact duplicates
                const newPos = altPos.clone().add(
                    new THREE.Vector3(randomFloat(-0.3, 0.3), 0, randomFloat(-0.3, 0.3))
                );
                // Keep Y at reasonable height
                newPos.y = randomFloat(0.25, 0.5);
                obj.mesh.position.copy(newPos);
                obj.currentPos.copy(newPos);
            } else {
                // Change colour to a noticeably different hue
                const newColor = this._generateDifferentColor(obj.originalColor);
                obj.mesh.material.color.set(newColor);
                obj.currentColor = newColor;
            }
        }

        return toChange.map(o => ({
            id: o.id,
            name: o.name,
            changeType: o.changeType,
        }));
    }

    /**
     * Generates a colour that's noticeably different from the given colour.
     * @param {string} hexColor - Original hex colour
     * @returns {string} New hex colour
     */
    _generateDifferentColor(hexColor) {
        // Parse original
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);

        // Generate a new hue that's at least 60 degrees away
        const rgb = { r: r / 255, g: g / 255, b: b / 255 };
        const max = Math.max(rgb.r, rgb.g, rgb.b);
        const min = Math.min(rgb.r, rgb.g, rgb.b);
        let hue = 0;
        if (max === min) {
            hue = 0;
        } else if (max === rgb.r) {
            hue = 60 * ((rgb.g - rgb.b) / (max - min));
        } else if (max === rgb.g) {
            hue = 60 * (2 + (rgb.b - rgb.r) / (max - min));
        } else {
            hue = 60 * (4 + (rgb.r - rgb.g) / (max - min));
        }
        if (hue < 0) hue += 360;

        // Shift hue by 120-240 degrees
        const shift = 120 + Math.random() * 120;
        const newHue = (hue + shift) % 360;

        return hslToHex(newHue, 70 + Math.random() * 30, 45 + Math.random() * 20);
    }

    /**
     * Marks an object as found (correct selection).
     * @param {string} objectId - The ID of the found object
     */
    markFound(objectId) {
        const obj = this.objects.find(o => o.id === objectId);
        if (obj) {
            obj.found = true;
        }
    }

    /**
     * Checks if all changes have been found.
     * @returns {boolean} True if all changed objects are found
     */
    allChangesFound() {
        return this.changedObjects.every(o => o.found);
    }

    /**
     * Gets the number of remaining changes to find.
     * @returns {number} Count of unfound changed objects
     */
    getRemainingChanges() {
        return this.changedObjects.filter(o => !o.found).length;
    }

    /**
     * Gets the total number of changes for this level.
     * @returns {number}
     */
    getTotalChanges() {
        return this.changedObjects.length;
    }

    /**
     * Gets an object by its mesh.
     * @param {THREE.Mesh} mesh - The mesh to look up
     * @returns {object|null} The object data or null
     */
    getObjectByMesh(mesh) {
        return this.objects.find(o => o.mesh === mesh) || null;
    }

    /**
     * Gets an object by its ID.
     * @param {string} id - Object ID
     * @returns {object|null}
     */
    getObjectById(id) {
        return this.objects.find(o => o.id === id) || null;
    }

    /**
     * Cleans up all room resources.
     */
    dispose() {
        this._clearObjects();
        this.scene.remove(this.roomGroup);
        // Dispose room geometries/materials would go here
    }
}
