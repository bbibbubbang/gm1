import * as THREE from 'three';
import { ForestMap } from './map/ForestMap.js';

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

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(-10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 40;
scene.add(dirLight);

// Initialize Forest Map
export const forestMap = new ForestMap(scene);
forestMap.init();

// Player setup
const player = new THREE.Group();
player.position.y = 1;

const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xffe0bd });
const clothesMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });

// Body
const bodyGeometry = new THREE.BoxGeometry(0.6, 1, 0.4);
const body = new THREE.Mesh(bodyGeometry, clothesMaterial);
body.position.y = 0; // Centered
body.castShadow = true;
body.receiveShadow = true;
player.add(body);

// Head
const headGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const head = new THREE.Mesh(headGeometry, skinMaterial);
head.position.y = 0.7; // Top of body (0.5) + half head height (0.2)
head.castShadow = true;
head.receiveShadow = true;
player.add(head);

// Eyes (to indicate front direction)
const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
const eyeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);

const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
leftEye.position.set(-0.1, 0.75, 0.21); // Front face (+z)
player.add(leftEye);

const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
rightEye.position.set(0.1, 0.75, 0.21); // Front face (+z)
player.add(rightEye);

// Arms
const armGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
const leftArm = new THREE.Mesh(armGeometry, skinMaterial);
leftArm.position.set(-0.4, 0.1, 0); // Next to body
leftArm.castShadow = true;
leftArm.receiveShadow = true;
player.add(leftArm);

const rightArm = new THREE.Mesh(armGeometry, skinMaterial);
rightArm.position.set(0.4, 0.1, 0); // Next to body
rightArm.castShadow = true;
rightArm.receiveShadow = true;
player.add(rightArm);

// Legs
const legGeometry = new THREE.BoxGeometry(0.25, 0.8, 0.25);
const pantsMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
const leftLeg = new THREE.Mesh(legGeometry, pantsMaterial);
leftLeg.position.set(-0.15, -0.9, 0); // Bottom of body is -0.5, so -0.5 - 0.4 = -0.9
leftLeg.castShadow = true;
leftLeg.receiveShadow = true;
player.add(leftLeg);

const rightLeg = new THREE.Mesh(legGeometry, pantsMaterial);
rightLeg.position.set(0.15, -0.9, 0); // Bottom of body is -0.5, so -0.5 - 0.4 = -0.9
rightLeg.castShadow = true;
rightLeg.receiveShadow = true;
player.add(rightLeg);

scene.add(player);

// Camera Pivot for 3rd Person View
const cameraPivot = new THREE.Object3D();
cameraPivot.rotation.order = 'YXZ';
scene.add(cameraPivot);

// Position camera behind and slightly above the player
camera.position.set(0, 2, 5);
cameraPivot.add(camera);

// --- Controls & Input ---
const instructions = document.getElementById('instructions');
const crosshair = document.getElementById('crosshair');

let controlsEnabled = false;

instructions.addEventListener('click', () => {
    document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        controlsEnabled = true;
        instructions.style.display = 'none';
        crosshair.style.display = 'block';
    } else {
        controlsEnabled = false;
        instructions.style.display = 'block';
        crosshair.style.display = 'none';
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
    if (!controlsEnabled) return;

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    euler.setFromQuaternion(cameraPivot.quaternion);

    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;

    // Clamp vertical look
    euler.x = Math.max(PI_2 - maxPolarAngle, Math.min(PI_2 - minPolarAngle, euler.x));
    // Limit looking up and down too much (avoids flipping)
    euler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, euler.x));

    cameraPivot.quaternion.setFromEuler(euler);
});

// --- Player Movement & Physics ---
const playerSpeed = 10;
const jumpForce = 15;
const gravity = 30;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

let isGrounded = true;

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

        // Determine movement direction
        direction.z = Number(keys.KeyS) - Number(keys.KeyW);
        direction.x = Number(keys.KeyD) - Number(keys.KeyA);
        direction.normalize(); // Ensure diagonal movement isn't faster

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

            velocity.z = moveDirection.z * playerSpeed;
            velocity.x = moveDirection.x * playerSpeed;

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

        // Apply velocity to position
        player.position.x += velocity.x * delta;
        player.position.z += velocity.z * delta;
        player.position.y += velocity.y * delta;

        // Apply boundary restrictions
        if (forestMap && forestMap.mapBounds) {
            const bounds = forestMap.mapBounds;

            // Failsafe: if player falls way below map or glitches completely out
            if (player.position.y < -10 ||
                player.position.x < bounds.minX - 5 ||
                player.position.x > bounds.maxX + 5 ||
                player.position.z < bounds.minZ - 5 ||
                player.position.z > bounds.maxZ + 5) {

                // Forceful teleport to spawn
                player.position.copy(forestMap.spawnPoint);
                velocity.set(0, 0, 0);
            } else {
                // Normal boundary clamp
                player.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, player.position.x));
                player.position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, player.position.z));
            }
        }

        // Basic Floor Collision
        if (player.position.y < 1) { // 1 is half capsule height + radius
            velocity.y = 0;
            player.position.y = 1;
            isGrounded = true;
        }
    }

    cameraPivot.position.copy(player.position);

    renderer.render(scene, camera);
}

animate();
