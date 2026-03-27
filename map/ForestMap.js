import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';

export class ForestMap {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.worldOctree = new Octree();

        // Boundaries for the map
        this.mapBounds = {
            minX: -22,
            maxX: 22,
            minZ: -22,
            maxZ: 22
        };

        // Spawn point for the player
        this.spawnPoint = new THREE.Vector3(0, 1, 0);

        this.models = [];
        this.enemies = [];
    }

    async loadModel(url) {
        return new Promise((resolve, reject) => {
            this.loader.load(url, (gltf) => {
                // Enable shadows for the loaded model
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                resolve(gltf.scene);
            }, undefined, reject);
        });
    }

    getElevation(x, z) {
        // Create natural looking hills using sine waves
        // Make a somewhat flat path in the middle (around x=0)
        let height = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 1;
        height += Math.sin(x * 0.05 + 1) * Math.sin(z * 0.05 + 2) * 2;

        // Flatten the center path
        const distFromCenter = Math.abs(x);
        const pathWidth = 10;
        if (distFromCenter < pathWidth) {
            height *= (distFromCenter / pathWidth);
        }

        return height;
    }

    async init() {
        // Create Forest Floor
        const floorGeometry = new THREE.PlaneGeometry(60, 60, 30, 30);

        // Apply elevation to the floor vertices
        const positions = floorGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i); // Plane is oriented in XY initially
            const z = this.getElevation(x, -y); // -y because it gets rotated around X by -PI/2
            positions.setZ(i, z);
        }
        floorGeometry.computeVertexNormals();

        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x3d7e35, roughness: 0.9, metalness: 0.1 });
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);

        const collidableGroup = new THREE.Group();
        collidableGroup.add(this.floor.clone());

        // Load textures if needed, but GLTFs usually come with their materials.

        // Define paths to models
        const modelPaths = {
            trees: [
                'asset/glTF/CommonTree_1.gltf',
                'asset/glTF/CommonTree_2.gltf',
                'asset/glTF/Pine_1.gltf',
                'asset/glTF/Pine_2.gltf',
                'asset/glTF/TwistedTree_1.gltf'
            ],
            bushes: [
                'asset/glTF/Bush_Common.gltf',
                'asset/glTF/Bush_Common_Flowers.gltf'
            ],
            rocks: [
                'asset/glTF/Rock_Medium_1.gltf',
                'asset/glTF/Rock_Medium_2.gltf',
                'asset/glTF/Rock_Medium_3.gltf'
            ],
            mushrooms: [
                'asset/glTF/Mushroom_Common.gltf',
                'asset/glTF/Mushroom_Laetiporus.gltf'
            ],
            grass: [
                'asset/glTF/Grass_Common_Short.gltf',
                'asset/glTF/Grass_Wispy_Short.gltf'
            ]
        };

        const loadCategory = async (paths) => {
            const loadPromises = paths.map(async (p) => {
                try {
                    console.log(`Starting load for: ${p}`);
                    const scene = await this.loadModel(p);
                    console.log(`Successfully loaded: ${p}`);
                    return scene;
                } catch(e) {
                    console.error('Failed to load ' + p, e);
                    return null;
                }
            });
            const results = await Promise.all(loadPromises);
            return results.filter(scene => scene !== null);
        };

        // Pre-load all model categories concurrently
        const [treeModels, bushModels, rockModels, mushroomModels, grassModels] = await Promise.all([
            loadCategory(modelPaths.trees),
            loadCategory(modelPaths.bushes),
            loadCategory(modelPaths.rocks),
            loadCategory(modelPaths.mushrooms),
            loadCategory(modelPaths.grass)
        ]);

        // Creates a collision-optimized clone by removing leaves
        const cloneForCollision = (model) => {
            const clone = model.clone();
            const toRemove = [];
            clone.traverse((child) => {
                if (child.isMesh && child.material) {
                    const matName = child.material.name || '';
                    const matNameLower = matName.toLowerCase();
                    if (matNameLower.includes('leaf') || matNameLower.includes('leav') || matNameLower.includes('pine')) {
                        toRemove.push(child);
                    }
                }
            });
            toRemove.forEach((child) => {
                if (child.parent) {
                    child.parent.remove(child);
                }
            });
            return clone;
        };

        // Helper function to scatter models
        const scatter = (models, count, scaleRange, avoidCenterRadius = 5, hasCollision = false) => {
            if (models.length === 0) {
                console.log(`Scatter called with 0 models!`);
                return;
            }
            console.log(`Scattering ${count} instances of ${models.length} models...`);
            let actualCount = 0;
            for (let i = 0; i < count; i++) {
                let x, z;
                // Generate position outside of the center avoid radius
                do {
                    x = Math.random() * (this.mapBounds.maxX - this.mapBounds.minX) + this.mapBounds.minX;
                    z = Math.random() * (this.mapBounds.maxZ - this.mapBounds.minZ) + this.mapBounds.minZ;
                } while (Math.sqrt(x * x + z * z) < avoidCenterRadius);

                const model = models[Math.floor(Math.random() * models.length)].clone();
                const scale = Math.random() * (scaleRange[1] - scaleRange[0]) + scaleRange[0];
                model.scale.set(scale, scale, scale);
                model.rotation.y = Math.random() * Math.PI * 2;
                const y = this.getElevation(x, z);
                model.position.set(x, y, z);
                model.updateMatrixWorld(true);

                this.scene.add(model);
                this.models.push(model);
                if (hasCollision) {
                    const collidableModel = cloneForCollision(model);
                    collidableGroup.add(collidableModel);
                }
                actualCount++;
            }
            console.log(`Successfully added ${actualCount} instances to scene.`);
        };

        // Scatter items across the map. Trees and rocks have collision.
        // We further reduce collision objects to improve Octree build times.
        scatter(treeModels, 15, [0.8, 1.5], 8, true);
        scatter(treeModels, 15, [0.8, 1.5], 8, true); // Visual only trees

        scatter(bushModels, 20, [0.8, 1.2], 5, false);

        scatter(rockModels, 5, [0.5, 1.5], 4, true);
        scatter(rockModels, 5, [0.5, 1.5], 4, true); // Visual only rocks

        scatter(mushroomModels, 25, [0.5, 1.0], 3, false);
        scatter(grassModels, 60, [1.0, 1.5], 2, false);

        // Create a dense visual boundary of trees and rocks to show limits
        if (treeModels.length > 0) {
            const boundaryTrees = 60;
            for(let i = 0; i < boundaryTrees; i++) {
                const angle = (i / boundaryTrees) * Math.PI * 2;
                // Place just outside the functional bounds
                const radius = 26;
                // Add some noise to the boundary placement
                const x = Math.cos(angle) * radius + (Math.random() * 2 - 1);
                const z = Math.sin(angle) * radius + (Math.random() * 2 - 1);

                const model = treeModels[Math.floor(Math.random() * treeModels.length)].clone();
                const scale = Math.random() * 0.6 + 1.2;
                model.scale.set(scale, scale, scale);
                model.rotation.y = Math.random() * Math.PI * 2;
                const y = this.getElevation(x, z);
                model.position.set(x, y, z);
                model.updateMatrixWorld(true);

                this.scene.add(model);
                this.models.push(model);

                // Do not add boundary trees to collision, player boundary checks prevent going here anyway
                collidableGroup.add(cloneForCollision(model));
            }
        }

        console.log("Building Octree...");
        console.time("buildOctree");
        collidableGroup.updateMatrixWorld(true);
        this.worldOctree.fromGraphNode(collidableGroup);
        // Add Dummy Monster in the center
        this.addDummyMonster();

        console.timeEnd("buildOctree");
        console.log("Octree built successfully.");
    }

    addDummyMonster() {
        const dummyGroup = new THREE.Group();

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.6; // Center of body
        body.castShadow = true;
        body.receiveShadow = true;
        dummyGroup.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xaa0000 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.45; // Top of body (1.2) + half head (0.25)
        head.castShadow = true;
        head.receiveShadow = true;
        dummyGroup.add(head);

        // Position dummy slightly offset from center to not overlap spawn
        const yPos = this.getElevation(3, 3);
        dummyGroup.position.set(3, yPos, 3);

        // Make it identifiable as an enemy
        dummyGroup.isEnemy = true;
        dummyGroup.hp = Infinity; // Infinite health
        dummyGroup.maxHp = Infinity;

        this.scene.add(dummyGroup);
        this.models.push(dummyGroup); // So it gets cleaned up
        this.enemies.push(dummyGroup);

        console.log("Dummy monster added at (3, y, 3).");
    }

    cleanup() {
        console.log("Cleaning up ForestMap...");
        if (this.floor) {
            this.scene.remove(this.floor);
            this.floor.geometry.dispose();
            if (this.floor.material) {
                if (Array.isArray(this.floor.material)) {
                    this.floor.material.forEach(m => m.dispose());
                } else {
                    this.floor.material.dispose();
                }
            }
        }

        this.models.forEach(model => {
            this.scene.remove(model);
            model.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        });

        this.models = [];
        this.worldOctree = new Octree(); // Reset octree
        console.log("ForestMap cleanup complete.");
    }
}
