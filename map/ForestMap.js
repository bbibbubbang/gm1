import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ForestMap {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();

        // Boundaries for the map
        this.mapBounds = {
            minX: -45,
            maxX: 45,
            minZ: -45,
            maxZ: 45
        };

        // Spawn point for the player
        this.spawnPoint = new THREE.Vector3(0, 1, 0);

        this.models = [];
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

    async init() {
        // Create Forest Floor
        const floorGeometry = new THREE.PlaneGeometry(120, 120);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x3d7e35, roughness: 0.9, metalness: 0.1 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

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

        // Helper function to scatter models
        const scatter = (models, count, scaleRange, avoidCenterRadius = 5) => {
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
                model.position.set(x, 0, z);

                this.scene.add(model);
                this.models.push(model);
                actualCount++;
            }
            console.log(`Successfully added ${actualCount} instances to scene.`);
        };

        // Scatter items across the map
        scatter(treeModels, 100, [0.8, 1.5], 8);
        scatter(bushModels, 60, [0.8, 1.2], 5);
        scatter(rockModels, 40, [0.5, 1.5], 4);
        scatter(mushroomModels, 80, [0.5, 1.0], 3);
        scatter(grassModels, 200, [1.0, 1.5], 2);

        // Create a dense visual boundary of trees and rocks to show limits
        if (treeModels.length > 0) {
            const boundaryTrees = 120;
            for(let i = 0; i < boundaryTrees; i++) {
                const angle = (i / boundaryTrees) * Math.PI * 2;
                // Place just outside the functional bounds
                const radius = 48;
                // Add some noise to the boundary placement
                const x = Math.cos(angle) * radius + (Math.random() * 2 - 1);
                const z = Math.sin(angle) * radius + (Math.random() * 2 - 1);

                const model = treeModels[Math.floor(Math.random() * treeModels.length)].clone();
                const scale = Math.random() * 0.6 + 1.2;
                model.scale.set(scale, scale, scale);
                model.rotation.y = Math.random() * Math.PI * 2;
                model.position.set(x, 0, z);

                this.scene.add(model);
                this.models.push(model);
            }
        }
    }
}
