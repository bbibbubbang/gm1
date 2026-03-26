import * as THREE from 'three';
import { ForestMap } from './map/ForestMap.js';
import { VillageMap } from './map/VillageMap.js';
import { Capsule } from 'three/addons/math/Capsule.js';

// --- Scene Setup ---
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); // increased intensity
dirLight.position.set(-10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 60;
scene.add(dirLight);

// Sun Mesh
const sunGeometry = new THREE.SphereGeometry(2, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
// Position sun far away in the direction of the light
const lightDirection = dirLight.position.clone().normalize();
sunMesh.position.copy(lightDirection.multiplyScalar(50));
scene.add(sunMesh);

// Initialize Map System
export let currentMap = null;
const mapInstances = {
    forest: new ForestMap(scene),
    village: new VillageMap(scene)
};

const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');

async function loadMap(mapId) {
    if (currentMap) {
        currentMap.cleanup();
    }

    loadingScreen.style.display = 'flex';
    instructions.style.display = 'none';
    loadingText.textContent = `Loading ${mapId} map...`;

    currentMap = mapInstances[mapId];
    await currentMap.init();

    // Reset player position
    playerCollider.start.set(currentMap.spawnPoint.x, currentMap.spawnPoint.y + 0.5, currentMap.spawnPoint.z);
    playerCollider.end.set(currentMap.spawnPoint.x, currentMap.spawnPoint.y + 1.9, currentMap.spawnPoint.z);
    velocity.set(0, 0, 0);

    loadingScreen.style.display = 'none';
    instructions.style.display = 'block';
}

// Initial map load
// We call this right away, and wait for it.
setTimeout(() => {
    loadMap('forest').catch(e => {
        console.error("Failed to load initial map:", e);
        loadingText.textContent = "Error loading map!";
    });
}, 0);

// Player setup
const player = new THREE.Group();
player.position.y = 1;

const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xffe0bd });
const clothesMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });

// Body
const bodyGeometry = new THREE.BoxGeometry(0.6, 1, 0.4);
const body = new THREE.Mesh(bodyGeometry, clothesMaterial);
body.position.y = 1.3; // Centered + 0.8 to stack on top of legs (y=0.4 + 0.4)
body.castShadow = true;
body.receiveShadow = true;
player.add(body);

// Head
const headGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const head = new THREE.Mesh(headGeometry, skinMaterial);
head.position.y = 2.0; // Top of body (1.3 + 0.5) + half head height (0.2)
head.castShadow = true;
head.receiveShadow = true;
player.add(head);

// Eyes (to indicate front direction)
const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
const eyeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);

const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
leftEye.position.set(-0.1, 2.05, 0.21); // Front face (+z)
player.add(leftEye);

const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
rightEye.position.set(0.1, 2.05, 0.21); // Front face (+z)
player.add(rightEye);

// Arms
const armGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
const leftArm = new THREE.Mesh(armGeometry, skinMaterial);
leftArm.position.set(-0.4, 1.4, 0); // Next to body
leftArm.castShadow = true;
leftArm.receiveShadow = true;
player.add(leftArm);

const rightArm = new THREE.Mesh(armGeometry, skinMaterial);
rightArm.position.set(0.4, 1.4, 0); // Next to body
rightArm.castShadow = true;
rightArm.receiveShadow = true;
player.add(rightArm);

// Legs
const legGeometry = new THREE.BoxGeometry(0.25, 0.8, 0.25);
const pantsMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
const leftLeg = new THREE.Mesh(legGeometry, pantsMaterial);
leftLeg.position.set(-0.15, 0.4, 0); // Raised by 0.9 so bottom is at 0 (-0.4 for leg center)
leftLeg.castShadow = true;
leftLeg.receiveShadow = true;
player.add(leftLeg);

const rightLeg = new THREE.Mesh(legGeometry, pantsMaterial);
rightLeg.position.set(0.15, 0.4, 0); // Raised by 0.9
rightLeg.castShadow = true;
rightLeg.receiveShadow = true;
player.add(rightLeg);

scene.add(player);

// Player Capsule Collider
const playerCollider = new Capsule(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 1.9, 0), 0.35);

// Camera Pivot for 3rd Person View
const cameraPivot = new THREE.Object3D();
cameraPivot.rotation.order = 'YXZ';
scene.add(cameraPivot);

// Position camera behind and slightly above the player
camera.position.set(0, 2.4, 5);
cameraPivot.add(camera);

// --- Controls & Input ---
const instructions = document.getElementById('instructions');
const crosshair = document.getElementById('crosshair');

let controlsEnabled = false;

// Mobile UI Elements
const joystickZone = document.getElementById('joystick-zone');
const touchLookZone = document.getElementById('touch-look-zone');

let isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

instructions.addEventListener('click', () => {
    if (isMobile) {
        // Mobile flow
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        }

        // Attempt to lock to landscape
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch((err) => {
                console.log(`Error locking orientation: ${err.message}`);
            });
        }

        controlsEnabled = true;
        instructions.style.display = 'none';

        // Show mobile UI instead of crosshair
        joystickZone.style.display = 'block';
        touchLookZone.style.display = 'block';
        document.getElementById('jump-btn').style.display = 'flex';

    } else {
        // Desktop flow
        document.body.requestPointerLock();
    }
});

const jumpBtn = document.getElementById('jump-btn');
if (jumpBtn) {
    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.Space = true;
    }, { passive: false });

    jumpBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.Space = false;
    }, { passive: false });

    jumpBtn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        keys.Space = false;
    }, { passive: false });
}

document.addEventListener('pointerlockchange', () => {
    if (!isMobile) {
        if (document.pointerLockElement === document.body) {
            controlsEnabled = true;
            instructions.style.display = 'none';
            crosshair.style.display = 'block';
        } else {
            controlsEnabled = false;
            instructions.style.display = 'block';
            crosshair.style.display = 'none';
        }
    }
});

const keys = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    Space: false
};

document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.code)) {
        keys[event.code] = true;
    }

    // Hotbar selection via number keys
    if (event.code.startsWith('Digit')) {
        const digit = parseInt(event.key);
        if (digit >= 1 && digit <= 9) {
            selectHotbarSlot(digit - 1);
            useSkill(digit - 1);
        }
    }
});

document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.code)) {
        keys[event.code] = false;
    }
});

// --- Mobile Joystick Input ---
const joystickKnob = document.getElementById('joystick-knob');
const joystickDirection = { x: 0, z: 0 };
let activeJoystickId = null;
let joystickStartX = 0;
let joystickStartY = 0;
const maxJoystickRadius = 35; // How far the knob can move from center

if (joystickZone) {
    joystickZone.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystickZone.addEventListener('touchmove', handleJoystickMove, { passive: false });
    joystickZone.addEventListener('touchend', handleJoystickEnd, { passive: false });
    joystickZone.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
}

function handleJoystickStart(e) {
    e.preventDefault();
    if (activeJoystickId !== null) return;

    // Track the first touch on the joystick
    const touch = e.changedTouches[0];
    activeJoystickId = touch.identifier;
    joystickStartX = touch.clientX;
    joystickStartY = touch.clientY;
    updateJoystick(touch);
}

function handleJoystickMove(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeJoystickId) {
            updateJoystick(touch);
            break;
        }
    }
}

function handleJoystickEnd(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeJoystickId) {
            activeJoystickId = null;
            joystickDirection.x = 0;
            joystickDirection.z = 0;
            joystickKnob.style.transform = `translate(-50%, -50%)`;
            break;
        }
    }
}

function updateJoystick(touch) {
    let dx = touch.clientX - joystickStartX;
    let dy = touch.clientY - joystickStartY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    // Clamp to max radius
    if (distance > maxJoystickRadius) {
        dx = (dx / distance) * maxJoystickRadius;
        dy = (dy / distance) * maxJoystickRadius;
    }

    // Update visual position of the knob
    joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Normalize values between -1 and 1
    // For 3D movement, Up (-dy) corresponds to forward (-z), Right (+dx) to right (+x)
    joystickDirection.x = dx / maxJoystickRadius;
    joystickDirection.z = dy / maxJoystickRadius;
}


// --- Hotbar & Skill System ---
const hotbarContainer = document.getElementById('hotbar-container');
const numSlots = 9;
const hotbarSlots = [];
let activeSlotIndex = 0;

// Initialize hotbar UI
for (let i = 0; i < numSlots; i++) {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot';

    const numberSpan = document.createElement('span');
    numberSpan.className = 'hotbar-number';
    numberSpan.textContent = i + 1;

    const iconSpan = document.createElement('span');
    iconSpan.textContent = ''; // Will hold skill icon/text

    const cooldownOverlay = document.createElement('div');
    cooldownOverlay.className = 'cooldown-overlay';

    slot.appendChild(numberSpan);
    slot.appendChild(iconSpan);
    slot.appendChild(cooldownOverlay);

    // Add touch support for skills
    slot.addEventListener('pointerdown', (e) => {
        // Prevent event from bubbling up and moving camera
        e.preventDefault();
        selectHotbarSlot(i);
        useSkill(i);
    });

    hotbarContainer.appendChild(slot);
    hotbarSlots.push({
        element: slot,
        icon: iconSpan,
        cooldownOverlay: cooldownOverlay,
        onCooldown: false,
        cooldownTimer: 0
    });
}

function selectHotbarSlot(index) {
    if (index < 0 || index >= numSlots) return;

    // Remove active class from previous
    hotbarSlots[activeSlotIndex].element.classList.remove('active');

    // Set new active
    activeSlotIndex = index;
    hotbarSlots[activeSlotIndex].element.classList.add('active');
}

// Select first slot by default
selectHotbarSlot(0);

const SKILL_COOLDOWN = 0.5; // seconds

function useSkill(slotIndex) {
    if (!controlsEnabled) return;

    const slot = hotbarSlots[slotIndex];
    if (slot.onCooldown) return;

    // Trigger skill logic
    console.log(`Used skill in slot ${slotIndex + 1}`);
    executeSkill(slotIndex + 1);

    // Start Cooldown
    slot.onCooldown = true;
    slot.cooldownTimer = SKILL_COOLDOWN;
    slot.cooldownOverlay.style.transition = 'none';
    slot.cooldownOverlay.style.height = '100%';

    // Force reflow to ensure transition applies correctly
    slot.cooldownOverlay.offsetHeight;

    slot.cooldownOverlay.style.transition = `height ${SKILL_COOLDOWN}s linear`;
    slot.cooldownOverlay.style.height = '0%';
}

// --- Test Skills Implementation ---
const activeProjectiles = [];

function executeSkill(skillNumber) {
    const forwardVector = new THREE.Vector3(0, 0, -1);
    forwardVector.applyQuaternion(cameraPivot.quaternion);

    switch (skillNumber) {
        case 1: // Fireball (Red Sphere projectile)
            createProjectile(0xff4500, forwardVector);
            break;
        case 2: // Ice Block (Blue Cube in front of player)
            createBlock(0x00bfff, forwardVector);
            break;
        case 3: // Self-Heal (Green aura around player)
            createAura(0x32cd32);
            break;
        case 4: // Dash (Quick forward movement)
            performDash(forwardVector);
            break;
        default:
            // Placeholder for other skills
            createProjectile(0xffffff, forwardVector); // White sphere default
            break;
    }
}

function createProjectile(color, direction) {
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 });
    const projectile = new THREE.Mesh(geometry, material);

    // Start slightly in front of the player
    projectile.position.copy(player.position).add(direction.clone().multiplyScalar(1.5));
    // Offset height to roughly chest/head level
    projectile.position.y += 0.5;

    scene.add(projectile);

    activeProjectiles.push({
        mesh: projectile,
        velocity: direction.clone().multiplyScalar(30), // Speed
        lifeTime: 2.0 // Seconds
    });
}

function createBlock(color, direction) {
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const material = new THREE.MeshStandardMaterial({ color: color, transparent: true, opacity: 0.8 });
    const block = new THREE.Mesh(geometry, material);

    // Spawn block 3 units in front
    block.position.copy(player.position).add(direction.clone().multiplyScalar(3));
    // Snap to floor roughly
    block.position.y = 0.75;

    scene.add(block);

    // Remove after a few seconds
    setTimeout(() => {
        scene.remove(block);
        geometry.dispose();
        material.dispose();
    }, 3000);
}

function createAura(color) {
    const geometry = new THREE.TorusGeometry(1, 0.1, 8, 24);
    const material = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.8 });
    const aura = new THREE.Mesh(geometry, material);

    aura.rotation.x = Math.PI / 2;
    player.add(aura); // Attach to player

    // Animate scale up and fade out (simplified)
    let scale = 1;
    const interval = setInterval(() => {
        scale += 0.1;
        aura.scale.set(scale, scale, scale);
        if (scale > 2) {
            player.remove(aura);
            geometry.dispose();
            material.dispose();
            clearInterval(interval);
        }
    }, 50);
}

function performDash(direction) {
    // A simplified dash: apply a large impulse to current velocity
    // Assuming direction is a normalized vector based on camera look direction
    velocity.x += direction.x * 30;
    velocity.z += direction.z * 30;
    // Don't dash up/down significantly to keep it simple, just planar
}


// --- Mouse Look ---
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const PI_2 = Math.PI / 2;
const minPolarAngle = 0;
const maxPolarAngle = Math.PI;

document.addEventListener('mousemove', (event) => {
    if (!controlsEnabled || isMobile || (optionsMenu && optionsMenu.style.display === 'flex')) return;

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    if (movementX !== 0 || movementY !== 0) {
        lastManualLookTime = performance.now();
    }

    updateCameraLook(movementX, movementY);
});

// Touch Look Logic
let activeLookTouchId = null;
let lastTouchX = 0;
let lastTouchY = 0;

if (touchLookZone) {
    touchLookZone.addEventListener('touchstart', handleLookStart, { passive: false });
    touchLookZone.addEventListener('touchmove', handleLookMove, { passive: false });
    touchLookZone.addEventListener('touchend', handleLookEnd, { passive: false });
    touchLookZone.addEventListener('touchcancel', handleLookEnd, { passive: false });
}

function handleLookStart(e) {
    e.preventDefault();
    if (activeLookTouchId !== null) return;

    const touch = e.changedTouches[0];
    activeLookTouchId = touch.identifier;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
}

function handleLookMove(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeLookTouchId) {

            // Multiplied by 10 to drastically increase mobile camera rotation sensitivity
            const movementX = (touch.clientX - lastTouchX) * 10;
            const movementY = (touch.clientY - lastTouchY) * 10;

            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;

            if (movementX !== 0 || movementY !== 0) {
                lastManualLookTime = performance.now();
            }

            updateCameraLook(movementX, movementY);
            break;
        }
    }
}

function handleLookEnd(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeLookTouchId) {
            activeLookTouchId = null;
            break;
        }
    }
}

function updateCameraLook(movementX, movementY) {
    euler.setFromQuaternion(cameraPivot.quaternion);

    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;

    // Clamp vertical look
    euler.x = Math.max(PI_2 - maxPolarAngle, Math.min(PI_2 - minPolarAngle, euler.x));
    // Limit looking up and down too much (avoids flipping)
    euler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, euler.x));

    cameraPivot.quaternion.setFromEuler(euler);
}

// --- Player Movement & Physics ---
const playerSpeed = 6;
const jumpForce = 15;
const gravity = 30;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

let isGrounded = true;

// --- Options Menu & Tracking Camera ---
const optionsBtn = document.getElementById('options-btn');
const optionsMenu = document.getElementById('options-menu');
const closeOptionsBtn = document.getElementById('close-options-btn');
const trackingCameraCb = document.getElementById('tracking-camera-cb');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const mapSelect = document.getElementById('map-select');

let trackingCameraEnabled = false;
let lastManualLookTime = 0;

if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
        optionsMenu.style.display = 'flex';
        if (!isMobile) {
            document.exitPointerLock();
        }
    });
}

if (mapSelect) {
    mapSelect.addEventListener('change', (e) => {
        const selectedMap = e.target.value;
        optionsMenu.style.display = 'none'; // Close options menu
        if (!isMobile) {
            document.exitPointerLock();
        }

        loadMap(selectedMap).catch(err => {
            console.error("Failed to switch map:", err);
            loadingText.textContent = "Error loading map!";
        });
    });
}

if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        }
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch((err) => {
                console.log(`Error locking orientation: ${err.message}`);
            });
        }
    });
}

if (closeOptionsBtn) {
    closeOptionsBtn.addEventListener('click', () => {
        optionsMenu.style.display = 'none';
        if (!isMobile && controlsEnabled) {
            document.body.requestPointerLock();
        }
    });
}

if (trackingCameraCb) {
    trackingCameraCb.addEventListener('change', (e) => {
        trackingCameraEnabled = e.target.checked;
    });
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Render Loop Setup
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // --- Update Projectiles ---
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const p = activeProjectiles[i];
        p.lifeTime -= delta;

        if (p.lifeTime <= 0) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            activeProjectiles.splice(i, 1);
        } else {
            // Move projectile
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
        }
    }

    // --- Update Cooldowns ---
    for (let i = 0; i < numSlots; i++) {
        const slot = hotbarSlots[i];
        if (slot.onCooldown) {
            slot.cooldownTimer -= delta;
            if (slot.cooldownTimer <= 0) {
                slot.onCooldown = false;
                slot.cooldownTimer = 0;
                slot.cooldownOverlay.style.transition = 'none';
                slot.cooldownOverlay.style.height = '0%';
            }
        }
    }

    if (controlsEnabled) {
        // --- Physics & Movement ---

        // Apply gravity
        velocity.y -= gravity * delta;

        // Determine movement direction (combining keyboard and joystick)
        direction.z = (Number(keys.KeyS) - Number(keys.KeyW)) + joystickDirection.z;
        direction.x = (Number(keys.KeyD) - Number(keys.KeyA)) + joystickDirection.x;

        // Clamp to max length 1 to prevent going faster by pressing both W and Joystick Forward
        const speedRatio = Math.min(direction.length(), 1.0);
        if (direction.length() > 0) {
            direction.normalize();
        }

        if (direction.z !== 0 || direction.x !== 0) {
            // Apply camera rotation to movement direction using forward/right vectors
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraPivot.quaternion);
            forward.y = 0;
            forward.normalize();

            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraPivot.quaternion);
            right.y = 0;
            right.normalize();

            // Calculate movement velocity vectors based on camera direction
            // direction.z is -1 for W, 1 for S. Multiply by forward vector.
            // direction.x is -1 for A, 1 for D. Multiply by right vector.
            const moveDirection = new THREE.Vector3()
                .addScaledVector(forward, -direction.z)
                .addScaledVector(right, direction.x)
                .normalize();

            velocity.z = moveDirection.z * playerSpeed * speedRatio;
            velocity.x = moveDirection.x * playerSpeed * speedRatio;

            // Rotate player mesh to face movement direction (optional, but looks good)
            const targetRotation = Math.atan2(velocity.x, velocity.z);
            // Smooth rotation towards target using shortest path
            let diff = targetRotation - player.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            player.rotation.y += diff * 10 * delta;
        } else {
            // Friction/Deceleration
            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;
        }

        // Jumping
        if (keys.Space && isGrounded) {
            velocity.y = jumpForce;
            isGrounded = false;
        }

        // Apply velocity to playerCollider
        const deltaPosition = velocity.clone().multiplyScalar(delta);
        playerCollider.translate(deltaPosition);

        // Apply boundary restrictions
        if (currentMap && currentMap.mapBounds) {
            const bounds = currentMap.mapBounds;

            // Failsafe: if player falls way below map or glitches completely out
            if (playerCollider.start.y < -10 ||
                playerCollider.start.x < bounds.minX - 5 ||
                playerCollider.start.x > bounds.maxX + 5 ||
                playerCollider.start.z < bounds.minZ - 5 ||
                playerCollider.start.z > bounds.maxZ + 5) {

                // Forceful teleport to spawn
                playerCollider.start.set(currentMap.spawnPoint.x, currentMap.spawnPoint.y + 0.5, currentMap.spawnPoint.z);
                playerCollider.end.set(currentMap.spawnPoint.x, currentMap.spawnPoint.y + 1.5, currentMap.spawnPoint.z);
                velocity.set(0, 0, 0);
            } else {
                // Normal boundary clamp
                playerCollider.start.x = Math.max(bounds.minX, Math.min(bounds.maxX, playerCollider.start.x));
                playerCollider.start.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, playerCollider.start.z));
                playerCollider.end.x = Math.max(bounds.minX, Math.min(bounds.maxX, playerCollider.end.x));
                playerCollider.end.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, playerCollider.end.z));
            }
        }

        // Octree Collision
        if (currentMap && currentMap.worldOctree) {
            const result = currentMap.worldOctree.capsuleIntersect(playerCollider);
            isGrounded = false;

            if (result) {
                isGrounded = result.normal.y > 0;

                if (!isGrounded) {
                    velocity.addScaledVector(result.normal, -result.normal.dot(velocity));
                }

                playerCollider.translate(result.normal.multiplyScalar(result.depth));
            }
        }

        // Apply capsule position to player mesh
        player.position.copy(playerCollider.start);
        player.position.y -= 0.35; // The base of capsule is at start.y - radius (0.5 - 0.35 = 0.15), and radius is 0.35

        // Tracking Camera Logic
        if (trackingCameraEnabled && (performance.now() - lastManualLookTime > 2000)) {
            // Check if player is moving
            const horizontalSpeedSq = velocity.x * velocity.x + velocity.z * velocity.z;
            if (horizontalSpeedSq > 0.1) {
                const moveYaw = Math.atan2(velocity.x, velocity.z) + Math.PI; // +PI so camera looks ALONG velocity

                // Camera current yaw
                euler.setFromQuaternion(cameraPivot.quaternion);
                const currentYaw = euler.y;

                // Shortest angular distance
                let diff = moveYaw - currentYaw;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));

                // Track if within 200 degrees (100 degrees each side) -> roughly 1.745 rad
                // We use Math.PI * (100/180) = 1.745. So if absolute diff is <= 1.745, track it.
                if (Math.abs(diff) <= (100 * Math.PI / 180)) {
                    // Smoothly interpolate camera yaw towards movement yaw
                    euler.y += diff * 2 * delta; // 2 is the tracking speed factor
                    cameraPivot.quaternion.setFromEuler(euler);
                }
            }
        }

        // Reset velocity y if grounded and not moving up
        if (isGrounded && velocity.y < 0) {
            velocity.y = 0;
        }
    }

    cameraPivot.position.copy(player.position);

    renderer.render(scene, camera);
}

animate();
