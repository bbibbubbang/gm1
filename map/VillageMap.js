import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { Octree } from 'three/addons/math/Octree.js';

export class VillageMap {
    constructor(scene) {
        this.scene = scene;
        this.objLoader = new OBJLoader();
        this.mtlLoader = new MTLLoader();
        this.worldOctree = new Octree();

        this.mapBounds = {
            minX: -22,
            maxX: 22,
            minZ: -22,
            maxZ: 22
        };

        this.spawnPoint = new THREE.Vector3(0, 1, 0);
        this.models = [];
        this.floor = null;

        // Ensure paths point to correct asset directory
        this.basePath = 'asset/Village/';
    }

    async loadModel(mtlFile, objFile) {
        return new Promise((resolve, reject) => {
            this.mtlLoader.setPath(this.basePath).load(mtlFile, (materials) => {
                materials.preload();
                this.objLoader.setMaterials(materials);
                this.objLoader.setPath(this.basePath).load(objFile, (object) => {
                    object.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;

                            // Adjust scale since assets might be small or big
                            child.scale.set(1, 1, 1);
                        }
                    });
                    resolve(object);
                }, undefined, reject);
            }, undefined, reject);
        });
    }

    async init() {
        console.log("Initializing VillageMap...");

        // Setup floor
        const floorGeometry = new THREE.PlaneGeometry(60, 60);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4B3D31, roughness: 1.0 }); // Darker dirt color
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);

        const collidableGroup = new THREE.Group();
        collidableGroup.add(this.floor.clone());

        // Map layout definitions
        // Since we are using an MTL file, we assume it's shared across the kit, or we use the specific MTLs if they exist per object.
        // Looking at the list_files output, there is `Materials_Modular_Village.mtl`
        const mtlFile = 'Materials_Modular_Village.mtl';

        const objectsToLoad = [
            // Road
            { file: 'Cobblestone_Floor_1.obj', pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 },
            { file: 'Cobblestone_Floor_1.obj', pos: [4, 0, 0], rot: [0, 0, 0], scale: 1 },
            { file: 'Cobblestone_Floor_1.obj', pos: [-4, 0, 0], rot: [0, 0, 0], scale: 1 },
            { file: 'Cobblestone_Floor_1.obj', pos: [0, 0, 4], rot: [0, 0, 0], scale: 1 },
            { file: 'Cobblestone_Floor_1.obj', pos: [0, 0, -4], rot: [0, 0, 0], scale: 1 },
            { file: 'Cobblestone_Floor_1.obj', pos: [-8, 0, 0], rot: [0, 0, 0], scale: 1 },
            { file: 'Cobblestone_Floor_1.obj', pos: [8, 0, 0], rot: [0, 0, 0], scale: 1 },
            { file: 'Cobblestone_Floor_1.obj', pos: [12, 0, 0], rot: [0, 0, 0], scale: 1 },

            // Central Well
            { file: 'Prop_Well_Cobblestone.obj', pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 },

            // Some barrels
            { file: 'Prop_Barrel_1.obj', pos: [2, 0, 2], rot: [0, 0, 0], scale: 1 },
            { file: 'Prop_Barrel_2.obj', pos: [2.5, 0, 1.8], rot: [0, Math.PI/4, 0], scale: 1 },
            { file: 'Prop_Barrel_1_Open.obj', pos: [1.8, 0, 2.5], rot: [0, -Math.PI/6, 0], scale: 1 },

            // Cart
            { file: 'Prop_Cart_1_Hay.obj', pos: [-5, 0, -3], rot: [0, Math.PI/3, 0], scale: 1 },

            // Walls/Fences (using stone curbs for borders)
            { file: 'Stone_Wall_1.obj', pos: [6, 0, 6], rot: [0, 0, 0], scale: 1 },
            { file: 'Stone_Wall_2.obj', pos: [6, 0, 3], rot: [0, 0, 0], scale: 1 },
            { file: 'Stone_Wall_1.obj', pos: [6, 0, 0], rot: [0, 0, 0], scale: 1 },
            { file: 'Stone_Wall_3.obj', pos: [6, 0, -3], rot: [0, 0, 0], scale: 1 },

            // Crate
            { file: 'Prop_Crate_1.obj', pos: [-2, 0, 4], rot: [0, 0.1, 0], scale: 1 },
            { file: 'Prop_Crate_1_Open.obj', pos: [-2, 0.5, 4], rot: [0, -0.2, 0], scale: 1 }, // stacked

            // Stone Pillar
            { file: 'Stone_Pillar.obj', pos: [-4, 0, -6], rot: [0, 0, 0], scale: 1 },

            // Street Lamp
            { file: 'Prop_Lamp_Street.obj', pos: [4, 0, -4], rot: [0, Math.PI/2, 0], scale: 1 },
            { file: 'Prop_Lamp_Street.obj', pos: [10, 0, -4], rot: [0, Math.PI/2, 0], scale: 1 },

            // Boat
            { file: 'Prop_Boat_1.obj', pos: [-8, 0, 8], rot: [0, Math.PI/4, 0], scale: 1 },

            // Stucco Arch
            { file: 'Stucco_Arch_Half.obj', pos: [0, 0, -8], rot: [0, 0, 0], scale: 1 },
            { file: 'Stucco_Arch_Half_Outer.obj', pos: [-4, 0, -8], rot: [0, 0, 0], scale: 1 },

            // House 1 (Stucco walls, roof, door, window)
            // Left wall
            { file: 'Stucco_Block.obj', pos: [10, 0, 4], rot: [0, Math.PI/2, 0], scale: 1 },
            { file: 'Stucco_Block.obj', pos: [10, 2, 4], rot: [0, Math.PI/2, 0], scale: 1 },
            // Right wall
            { file: 'Stucco_Block.obj', pos: [14, 0, 4], rot: [0, Math.PI/2, 0], scale: 1 },
            { file: 'Stucco_Block.obj', pos: [14, 2, 4], rot: [0, Math.PI/2, 0], scale: 1 },
            // Back wall
            { file: 'Stucco_Block.obj', pos: [12, 0, 6], rot: [0, 0, 0], scale: 1 },
            { file: 'Stucco_Block.obj', pos: [12, 2, 6], rot: [0, 0, 0], scale: 1 },

            // Front wall (door and window)
            // Replace middle block with door/window props directly or leave a gap
            { file: 'Wall_Prop_Door_Simple.obj', pos: [11, 0, 2], rot: [0, 0, 0], scale: 1 },
            { file: 'Stucco_Window_Single_Wide.obj', pos: [13, 0, 2], rot: [0, 0, 0], scale: 1 },
            { file: 'Stucco_Block.obj', pos: [12, 2, 2], rot: [0, 0, 0], scale: 1 },

            // Roof
            { file: 'Roof_Straight_Side.obj', pos: [12, 4, 3], rot: [Math.PI/4, 0, 0], scale: 1.5 },
            { file: 'Roof_Straight_Side.obj', pos: [12, 4, 5], rot: [-Math.PI/4, 0, 0], scale: 1.5 }
        ];

        try {
            const loadPromises = objectsToLoad.map(async (def) => {
                const model = await this.loadModel(mtlFile, def.file);

                // Adjust model properties based on definition
                model.position.set(def.pos[0], def.pos[1], def.pos[2]);
                model.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
                model.scale.set(def.scale, def.scale, def.scale);

                // Ensure matrix is updated
                model.updateMatrixWorld(true);

                this.scene.add(model);
                this.models.push(model);

                // Add clone to octree for collision
                const collidableClone = model.clone();
                collidableGroup.add(collidableClone);
            });

            await Promise.all(loadPromises);
            console.log("Successfully loaded Village assets.");
        } catch (error) {
            console.error("Error loading Village assets:", error);
        }

        console.log("Building Octree...");
        console.time("buildOctree");
        collidableGroup.updateMatrixWorld(true);
        this.worldOctree.fromGraphNode(collidableGroup);
        console.timeEnd("buildOctree");
        console.log("Octree built successfully for VillageMap.");
    }

    cleanup() {
        console.log("Cleaning up VillageMap...");
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
        console.log("VillageMap cleanup complete.");
    }
}
