import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js';

// Configuration state manager - keeps track of all selections
class ConfigurationState {
    constructor() {
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
        // Handle special case for size updates - trigger dimension recalculation
        if (key === 'size') {
            this.updateDimensionsFromSize(value);
        }
        
        this.config[key] = value;
        this.notifyListeners(key, value);
    }

    updateDimensionsFromSize(sizeString) {
        const dimensions = this.parseSizeString(sizeString);
        if (dimensions) {
            this.config.length = dimensions.length;
            this.config.width = dimensions.width;
        }
    }

    parseSizeString(sizeString) {
        if (!sizeString) return null;
        
        // Parse common size formats: "6m x 4m", "6 x 4", "Large (8x6)", etc.
        const match = sizeString.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
        if (match) {
            return {
                length: parseFloat(match[1]),
                width: parseFloat(match[2])
            };
        }
        
        // Fallback size mappings
        const sizeMap = {
            'Small': { length: 4, width: 3 },
            'Medium': { length: 6, width: 4 },
            'Large': { length: 8, width: 6 },
            'Extra Large': { length: 10, width: 8 }
        };
        
        return sizeMap[sizeString] || null;
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

// Dynamic Positioning Calculator - The heart of our refactoring
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

// Dropdown handler - clean and reusable
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

// 3D Scene Manager - now with dynamic positioning system
class CanopyConfigurator3D {
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
        console.log(`Configuration changed: ${key} = ${value}`);
        
        switch(key) {
            case 'canopyType':
                this.updateCanopyConfiguration(fullConfig);
                this.updateRoofConfiguration(fullConfig);
                this.updateCameraPosition(fullConfig);
                break;
            case 'roofType':
                this.updateRoofConfiguration(fullConfig);
                break;
            case 'size':
                // Size changes trigger comprehensive updates
                this.updateCanopyConfiguration(fullConfig);
                this.updateRoofConfiguration(fullConfig);
                this.updateCameraPosition(fullConfig);
                this.updateEnvironmentScale(fullConfig);
                break;
            case 'color':
                this.updateCanopyColor(value);
                this.updateRoofColor(value);
                break;
            case 'length':
            case 'width':
                // Dimension changes trigger positioning updates
                this.updateCanopyDimensions(fullConfig);
                this.updateRoofDimensions(fullConfig);
                this.updateCameraPosition(fullConfig);
                break;
        }
    }

    async loadCanopyTemplate() {
        try {
            const modelPath = 'models/freestanding_white.glb';
            const gltf = await this.loadGLTFModel(modelPath);
            
            this.canopyModelTemplate = gltf.scene;
            console.log("Canopy template loaded successfully");
            
            await this.loadRoofTemplates();
            
            this.updateCanopyConfiguration(this.configState.getConfig());
            this.updateRoofConfiguration(this.configState.getConfig());
            
        } catch (error) {
            console.error("Failed to load canopy template:", error);
            this.createFallbackTemplate();
            this.updateCanopyConfiguration(this.configState.getConfig());
        }
    }

    async loadRoofTemplates() {
        console.log("Loading roof templates...");
        const roofTypes = ['flat_glass_white'];

        for (const type of roofTypes) {
            const modelPath = `models/roof/${type}.glb`;
            this.roofTemplates[type] = await this.loadGLTFModel(modelPath);
        }

        console.log("Roof templates loaded successfully");
    }

    getRoofTemplateKey(roofType) {
        const mapping = {
            'Flat glass roof': 'flat_glass_white'
        };
        return mapping[roofType] || roofType?.toLowerCase();
    }

    updateRoofConfiguration(config) {
        if (this.currentRoofGroup) {
            this.scene.remove(this.currentRoofGroup);
        }
        this.currentRoofGroup = new THREE.Group();

        const templateKey = this.getRoofTemplateKey(config.roofType);
        const roofTemplate = this.roofTemplates[templateKey];
        if (!roofTemplate) {
            console.warn("No roof template available for", templateKey);
            return;
        }

        const roofModel = roofTemplate.scene ? roofTemplate.scene.clone() : roofTemplate.clone();
        
        // Apply dynamic positioning to roof
        const positioning = this.positionCalculator.calculateCanopyPositioning(config);
        this.setupModelProperties(roofModel, positioning.unit1);
        
        this.currentRoofGroup.add(roofModel);
        this.scene.add(this.currentRoofGroup);
    }

    updateCanopyConfiguration(config) {
        console.log(`Updating canopy configuration for: ${config.canopyType}`);
        
        if (this.currentCanopyGroup) {
            this.scene.remove(this.currentCanopyGroup);
        }

        this.currentCanopyGroup = new THREE.Group();
        
        if (!this.canopyModelTemplate) {
            console.warn("No canopy template available yet");
            return;
        }

        // Use dynamic positioning calculator
        const positioning = this.positionCalculator.calculateCanopyPositioning(config);

        if (config.canopyType === 'free-standing') {
            this.createFreeStandingConfiguration(config, positioning);
        } else {
            this.createWallMountedConfiguration(config, positioning);
        }

        this.scene.add(this.currentCanopyGroup);
    }

    createFreeStandingConfiguration(config, positioning) {
        console.log("Creating free-standing canopy (2 units) with dynamic positioning");
        
        const unit1 = this.canopyModelTemplate.clone();
        const unit2 = this.canopyModelTemplate.clone();

        unit1.position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
        unit2.position.set(positioning.unit2.x, positioning.unit2.y, positioning.unit2.z);
        
        unit2.rotation.y = Math.PI;
        
        this.setupModelProperties(unit1);
        this.setupModelProperties(unit2);
        
        this.currentCanopyGroup.add(unit1);
        this.currentCanopyGroup.add(unit2);
        
        console.log(`Free-standing canopy created with spacing: ${positioning.unit1.x * 2}m`);
    }

    createWallMountedConfiguration(config, positioning) {
        console.log("Creating wall-mounted canopy (1 unit) with dynamic positioning");
        
        const unit = this.canopyModelTemplate.clone();
        unit.position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
        
        this.setupModelProperties(unit);
        this.currentCanopyGroup.add(unit);
        
        console.log(`Wall-mounted canopy created at position: ${positioning.unit1.x}, ${positioning.unit1.z}`);
    }

    updateCanopyDimensions(config) {
        if (!this.currentCanopyGroup || this.currentCanopyGroup.children.length === 0) return;
        
        const positioning = this.positionCalculator.calculateCanopyPositioning(config);
        const units = this.currentCanopyGroup.children;
        
        if (config.canopyType === 'free-standing' && units.length === 2) {
            units[0].position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
            units[1].position.set(positioning.unit2.x, positioning.unit2.y, positioning.unit2.z);
        } else if (units.length === 1) {
            units[0].position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
        }
        
        console.log("Canopy dimensions updated dynamically");
    }

    updateRoofDimensions(config) {
        if (!this.currentRoofGroup || this.currentRoofGroup.children.length === 0) return;
        
        const positioning = this.positionCalculator.calculateCanopyPositioning(config);
        const roofUnits = this.currentRoofGroup.children;
        
        roofUnits.forEach(unit => {
            unit.position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
        });
        
        console.log("Roof dimensions updated to match canopy");
    }

    updateCameraPosition(config) {
        const cameraPos = this.positionCalculator.calculateOptimalCameraPosition(config);
        
        // Smoothly animate camera to new position
        if (this.controls) {
            this.controls.target.set(cameraPos.lookAt.x, cameraPos.lookAt.y, cameraPos.lookAt.z);
            this.camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
            this.controls.update();
        }
        
        console.log(`Camera repositioned for optimal viewing: ${JSON.stringify(cameraPos)}`);
    }

    updateEnvironmentScale(config) {
        const envScale = this.positionCalculator.calculateEnvironmentScale(config);
        
        // Update ground plane
        const ground = this.scene.getObjectByName('ground');
        if (ground) {
            ground.geometry.dispose();
            ground.geometry = new THREE.PlaneGeometry(envScale.groundSize, envScale.groundSize);
        }
        
        // Update light positioning
        const directionalLight = this.scene.children.find(child => 
            child.type === 'DirectionalLight' && child.castShadow
        );
        if (directionalLight) {
            directionalLight.position.set(
                envScale.lightDistance, 
                30, 
                envScale.lightDistance
            );
        }
        
        console.log(`Environment scaled: ground=${envScale.groundSize}, light distance=${envScale.lightDistance}`);
    }

    loadGLTFModel(path) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => resolve(gltf),
                (progress) => console.log('Loading progress:', progress),
                (error) => reject(error)
            );
        });
    }

    setupModelProperties(model, positioning = null) {
        model.position.y = this.positionCalculator.spacingRules.environment.groundLevel;
        model.scale.setScalar(8);
        
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }

    updateCanopyColor(colorName) {
        if (!this.currentCanopyGroup) return;

        const colorMap = {
            'Charcoal': 0x2c3e50,
            'White': 0xffffff,
            'Bronze': 0x8B4513,
            'Slate Grey': 0x708090,
            'Forest Green': 0x228B22,
            'Deep Red': 0x8B0000
        };

        const color = colorMap[colorName] || 0x2c2c2c;

        this.currentCanopyGroup.traverse((child) => {
            if (child.isMesh && child.material) {
                if (!child.material.transparent) {
                    child.material.color.setHex(color);
                }
            }
        });
    }

    updateRoofColor(colorName) {
        if (!this.currentRoofGroup) return;

        const colorMap = {
            'Charcoal': 0x2c3e50,
            'White': 0xffffff,
            'Bronze': 0x8B4513,
            'Slate Grey': 0x708090,
            'Forest Green': 0x228B22,
            'Deep Red': 0x8B0000
        };

        const color = colorMap[colorName] || 0x2c2c2c;

        this.currentRoofGroup.traverse((child) => {
            if (child.isMesh && child.material) {
                if (!child.material.transparent) {
                    child.material.color.setHex(color);
                }
            }
        });
    }

    createFallbackTemplate() {
        const templateGroup = new THREE.Group();
        
        const postGeometry = new THREE.CylinderGeometry(0.5, 0.5, 25);
        const postMaterial = new THREE.MeshLambertMaterial({ color: 0x2c2c2c });
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(0, 0, 0);
        
        const roofGeometry = new THREE.PlaneGeometry(15, 10);
        const roofMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x87ceeb, 
            transparent: true, 
            opacity: 0.3 
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.rotation.x = -Math.PI / 2;
        roof.position.y = 12;
        
        templateGroup.add(post);
        templateGroup.add(roof);
        
        this.canopyModelTemplate = templateGroup;
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

    setUpRender() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.controls?.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const configState = new ConfigurationState();
    const dropdownHandler = new DropdownHandler(configState);
    
    setTimeout(() => {
        const canopy3D = new CanopyConfigurator3D(configState);
    }, 100);
    
    const submitButton = document.querySelector('.submit-button');
    if (submitButton) {
        submitButton.addEventListener('click', function() {
            const config = configState.getConfig();
            console.log('Current configuration:', config);
            alert('Configuration submitted! We\'ll contact you with your instant estimate.');
        });
    }
});