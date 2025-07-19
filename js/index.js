import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js';


class ConfigurationState{
    constructor(){
        console.log("ConfigurationState initialized");
         this.config = {
            canopyType: 'free-standing',
            roofType: null,
            size: null,
            walls: [],
            accessories: [],
            color: null,
            // Dynamic dimensions based on size selection
            length: 6,
            width: 4
        };

        this.listeners = [];
    }
    updateConfig(key, value) {
        // Directly update the config property
        this.config[key] = value;
        this.notifyListeners(key, value);
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(key, value) {
        this.listeners.forEach(callback => callback(key, value, this.config));
    }

    getConfig() {
        return { ...this.config };
    }
}

class PositioningCalculator {
    constructor() {
        // Configuration-driven spacing rules
        this.spacingRules = {
            // Base spacing multipliers by size
            spacing: {
                small: 1.0,
                medium: 1.2,
                large: 1.5,
                extraLarge: 1.8
            },
            // Depth offset calculations
            depth: {
                wallMountZ: 20,
                freeStandingBase: 22.5,
                additionalDepthPerMeter: 2.5
            },
            // Ground and camera positioning
            environment: {
                groundLevel: -25,
                cameraHeightMultiplier: 0.8,
                cameraDistanceMultiplier: 2.5
            }
        };
    }

    calculateCanopyPositioning(config) {
        const spacing = this.getSpacingForSize(config);
        const depth = this.getDepthForSize(config);
        
        if (config.canopyType === 'free-standing') {
            return {
                unit1: {
                    x: spacing / 2,
                    y: 0,
                    z: this.spacingRules.depth.wallMountZ
                },
                unit2: {
                    x: -spacing / 2,
                    y: 0,
                    z: -depth
                }
            };
        } else {
            return {
                unit1: {
                    x: spacing / 2,
                    y: 0,
                    z: this.spacingRules.depth.wallMountZ
                }
            };
        }
    }

    getSpacingForSize(config) {
        const baseSpacing = config.length || 6;
        const sizeMultiplier = this.getSizeMultiplier(config.size);
        return baseSpacing * sizeMultiplier;
    }

    getDepthForSize(config) {
        const baseDepth = this.spacingRules.depth.freeStandingBase;
        const additionalDepth = (config.width || 4) * this.spacingRules.depth.additionalDepthPerMeter;
        return baseDepth + additionalDepth;
    }

    getSizeMultiplier(sizeString) {
        if (!sizeString) return this.spacingRules.spacing.medium;
        
        const size = sizeString.toLowerCase();
        if (size.includes('small')) return this.spacingRules.spacing.small;
        if (size.includes('large') && size.includes('extra')) return this.spacingRules.spacing.extraLarge;
        if (size.includes('large')) return this.spacingRules.spacing.large;
        return this.spacingRules.spacing.medium;
    }

    calculateOptimalCameraPosition(config) {
        const spacing = this.getSpacingForSize(config);
        const depth = this.getDepthForSize(config);
        
        // Dynamic camera positioning based on canopy size
        const maxDimension = Math.max(spacing, depth);
        const distance = maxDimension * this.spacingRules.environment.cameraDistanceMultiplier;
        const height = maxDimension * this.spacingRules.environment.cameraHeightMultiplier;
        
        return {
            x: distance * 0.7,
            y: height,
            z: distance * 0.7,
            lookAt: { x: 0, y: 0, z: 0 }
        };
    }

    calculateEnvironmentScale(config) {
        const spacing = this.getSpacingForSize(config);
        const depth = this.getDepthForSize(config);
        const maxDimension = Math.max(spacing, depth);
        
        // Scale ground plane to accommodate canopy size
        const groundScale = Math.max(200, maxDimension * 8);
        
        return {
            groundSize: groundScale,
            lightDistance: maxDimension * 1.5
        };
    }
}

class DropdownHandler {
    constructor(configState) {
        this.configState = configState;
        this.init();
    }

    init() {
        document.querySelectorAll('.dropdown-option').forEach(option => {
            option.addEventListener('click', (e) => this.handleOptionClick(e));
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavClick(e));
        });
    }

    handleOptionClick(event) {
        const option = event.target;
        const navItem = option.closest('.nav-item');
        const tabType = navItem.querySelector('.nav-link').dataset.tab;
        
        const siblings = option.parentElement.querySelectorAll('.dropdown-option');
        siblings.forEach(sibling => sibling.classList.remove('selected'));
        
        option.classList.add('selected');
        
        this.updateConfigFromSelection(tabType, option);
        
        this.closeDropdown(option.closest('.dropdown-menu'));
    }

    updateConfigFromSelection(tabType, option) {
        const optionText = option.textContent.trim();
        
        switch(tabType) {
            case 'canopy':
                const canopyType = optionText === 'Free Standing Canopy' ? 'free-standing' : 'wall-mounted';
                this.configState.updateConfig('canopyType', canopyType);
                break;
            case 'roof':
                this.configState.updateConfig('roofType', optionText);
                break;
            case 'size':
                this.configState.updateConfig('size', optionText);
                break;
            case 'colour':
                this.configState.updateConfig('color', optionText);
                break;
        }
    }

    handleNavClick(event) {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));
        event.target.classList.add('active');
    }

    closeDropdown(dropdown) {
        if (dropdown) {
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            setTimeout(() => {
                dropdown.style.opacity = '';
                dropdown.style.visibility = '';
            }, 300);
        }
    }
}


class Configurator {
    constructor(configState) {
        this.configState = configState;
            this.positionCalculator = new PositioningCalculator();
                
            // Store loaded model templates
            this.canopyModelTemplate = null;
            this.currentCanopyGroup = null;
            this.roofTemplates = {};
            this.currentRoofGroup = null;
        
            this.loader = new GLTFLoader();
                
            // Listen for configuration changes
            this.configState.onChange((key, value, fullConfig) => {
                this.handleConfigChange(key, value, fullConfig);
            });
        console.log("Configurator initialized");

        this.init();
    }

    init() {
        this.setUpScene();
        this.setUpCamera();
        this.setUpRenderer();
        this.setUpLights();
        this.createEnvironment();
        this.setUpRender();
        this.setUpControls();

        this.loadCanopyTemplate();
    }

    handleConfigChange(key, value, fullConfig) {
        console.log ("The configuration has changed:", key, value, fullConfig);

        switch (key) {
            case 'canopyType':
                console.log ("This is the state now:", fullConfig);
                this.updateCanopyConfiguration(fullConfig);
                break;

            case 'size':
                console.log("Size changed to:", value);
        }
    }

    async loadCanopyTemplate(){
         try {
            const modelPath = 'models/canopies/freestanding_white.glb';
            const gltf = await this.loadGLTFModel(modelPath);
            
            this.canopyModelTemplate = gltf.scene;
            console.log("Canopy template loaded successfully");
            this.updateCanopyConfiguration(this.configState.getConfig());       
        } catch (error) {
            console.error("Failed to load canopy template:", error);
            //this.createFallbackTemplate();
            //this.updateCanopyConfiguration(this.configState.getConfig());
        }
    }

    updateCanopyConfiguration(config) {
        console.log(`Updating canopy configuration for: ${config.canopyType}`);

        if (this.currentCanopyGroup) {
            this.scene.remove(this.currentCanopyGroup);
            this.currentCanopyGroup = null;
        }

        if (!this.canopyModelTemplate) {
            console.warn("Canopy model template is not loaded yet.");
            return;
        }

        this.currentCanopyGroup = new THREE.Group();

        const canopyPositioning = this.positionCalculator.calculateCanopyPositioning(config);
        if (config.canopyType === 'free-standing') {
            this.createFreeStandingCanopy(config, canopyPositioning);
        }else {
            this.createWallMountedCanopy(config, canopyPositioning);
        }

        this.scene.add(this.currentCanopyGroup);

    }

    createWallMountedCanopy (config, canopyPositioning){
        console.log("creating wall mounted canopy");
    }

    createFreeStandingCanopy( config, canopyPositioning){
        console.log("Creating free-standing canopy");
    }

    loadGLTFModel(modelPath) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                modelPath,
                (gltf) => resolve(gltf),
                (progress) => console.log('Loading progress:', progress),
                (error) => reject(error)
            );
        });
    }

    setUpScene() {
         this.scene = new THREE.Scene();

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');

        const gradient = context.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#f8f8f8');
        gradient.addColorStop(1, '#ffffff');

        context.fillStyle = gradient;
        context.fillRect(0, 0, 512, 512);

        const texture = new THREE.CanvasTexture(canvas);
        this.scene.background = texture;
    }

    setUpCamera() {
        const container = document.getElementById('visualization-area');
        const containerRect = container.getBoundingClientRect();

        this.camera = new THREE.PerspectiveCamera(
            75, 
            containerRect.width / containerRect.height,
            0.1, 
            7000
        );
        
        // Use dynamic camera positioning
        const config = this.configState.getConfig();
        const cameraPos = this.positionCalculator.calculateOptimalCameraPosition(config);
        this.camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
        this.camera.lookAt(new THREE.Vector3(cameraPos.lookAt.x, cameraPos.lookAt.y, cameraPos.lookAt.z));
    }

    setUpRenderer() {
        const canvas = document.getElementById('scene-canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
        });

        const container = document.getElementById('visualization-area');
        const containerRect = container.getBoundingClientRect();

        this.renderer.setSize(containerRect.width, containerRect.height);
        this.renderer.setClearColor(0x222222);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setUpControls() {
        const container = document.getElementById('visualization-area');
        this.controls = new OrbitControls(this.camera, container);

        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        this.controls.enableZoom = true;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI / 2;

        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    setUpLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const config = this.configState.getConfig();
        const envScale = this.positionCalculator.calculateEnvironmentScale(config);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(envScale.lightDistance, 30, envScale.lightDistance);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-10, 10, -10);
        this.scene.add(fillLight);
    }

    setUpRender() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.controls?.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    createEnvironment() {
        const config = this.configState.getConfig();
        const envScale = this.positionCalculator.calculateEnvironmentScale(config);

        const groundGeometry = new THREE.PlaneGeometry(envScale.groundSize, envScale.groundSize);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xd4a574
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = this.positionCalculator.spacingRules.environment.groundLevel;
        ground.receiveShadow = true;
        ground.name = 'ground'; // Name for easy reference
        this.scene.add(ground);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const configState = new ConfigurationState();
    const dropdown = new DropdownHandler(configState);

    setTimeout(() => {
        console.log("ConfigurationState and DropdownHandler instances created");
        const configurator = new Configurator(configState);
    }, 300);
});