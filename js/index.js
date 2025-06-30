import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js';


// Configuration state manager - keeps track of all selections
class ConfigurationState {
    constructor() {
        this.config = {
            canopyType: 'free-standing', // default
            roofType: null,
            size: null,
            walls: [],
            accessories: [],
            color: null,
            // Future scalability - dimensions
            length: 6, // default length in meters
            width: 4   // default width in meters
        };
        this.listeners = [];
    }

    updateConfig(key, value) {
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

// 3D Scene Manager - handles all 3D operations with scalable model approach
class CanopyConfigurator3D {
    constructor(configState) {
        console.log("Creating Canopy Configurator 3D instance...");
        this.configState = configState;
        
        // Store loaded model template for reuse
        this.canopyModelTemplate = null;
        this.currentCanopyGroup = null; // Group containing all canopy instances
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
        
        // Load the base model template first, then create canopy configuration
        this.loadCanopyTemplate();
    }

    handleConfigChange(key, value, fullConfig) {
        console.log(`Configuration changed: ${key} = ${value}`);
        
        switch(key) {
            case 'canopyType':
                this.updateCanopyConfiguration(fullConfig);
                break;
            case 'color':
                this.updateCanopyColor(value);
                break;
            case 'length':
            case 'width':
                // Future feature: Update positioning based on dimensions
                this.updateCanopyDimensions(fullConfig);
                break;
        }
    }

    /**
     * Load the base canopy model template that will be reused
     * This is your single 3D model file
     */
    async loadCanopyTemplate() {
        console.log("Loading canopy model template...");
        
        try {
            const modelPath = 'models/freestanding_white.glb';
            const gltf = await this.loadGLTFModel(modelPath);
            
            // Store the template - we'll clone this for each instance
            this.canopyModelTemplate = gltf.scene;
            
            console.log("Canopy template loaded successfully");
            
            // Now create the initial canopy configuration
            this.updateCanopyConfiguration(this.configState.getConfig());
            
        } catch (error) {
            console.error("Failed to load canopy template:", error);
            // Fall back to programmatic model
            this.createFallbackTemplate();
            this.updateCanopyConfiguration(this.configState.getConfig());
        }
    }

    /**
     * Update the canopy configuration based on type (wall-mounted vs free-standing)
     * This is where the magic happens - one model vs two models
     */
    updateCanopyConfiguration(config) {
        console.log(`Updating canopy configuration for: ${config.canopyType}`);
        
        // Remove existing canopy group
        if (this.currentCanopyGroup) {
            this.scene.remove(this.currentCanopyGroup);
        }

        // Create new group for canopy instances
        this.currentCanopyGroup = new THREE.Group();
        
        if (!this.canopyModelTemplate) {
            console.warn("No canopy template available yet");
            return;
        }

        if (config.canopyType === 'free-standing') {
            this.createFreeStandingConfiguration(config);
        } else {
            this.createWallMountedConfiguration(config);
        }

        this.scene.add(this.currentCanopyGroup);
    }

    /**
     * Create free-standing configuration: Two model instances
     */
    createFreeStandingConfiguration(config) {
        console.log("Creating free-standing canopy (2 units)");
        
        const unit1 = this.canopyModelTemplate.clone();
        const unit2 = this.canopyModelTemplate.clone();
    
        // GET the calculated positions
        const positioning = this.calculateCanopyPositioning(config, 'free-standing');
    
    // USE the calculated positions
    unit1.position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
    unit2.position.set(positioning.unit2.x, positioning.unit2.y, positioning.unit2.z);
        
        // Mirror the second unit so they face each other (optional - depends on your model)
        unit2.rotation.y = Math.PI;
        
        // Apply common properties to both units
        this.setupModelProperties(unit1);
        this.setupModelProperties(unit2);
        
        // Add both units to the group
        this.currentCanopyGroup.add(unit1);
        this.currentCanopyGroup.add(unit2);
        
        console.log("Free-standing canopy created with 2 units");
    }

    /**
     * Create wall-mounted configuration: Single model instance
     */
    createWallMountedConfiguration(config) {
        console.log("Creating wall-mounted canopy (1 unit)");
        
        // Clone the template once
        const unit = this.canopyModelTemplate.clone();
        const spacing = this.calculateUnitSpacing(config);
        
        // Position for wall mounting (against back wall)
        unit.position.set(spacing/2, 0, 20); // Adjust Z to position against wall
        
        // Apply common properties
        this.setupModelProperties(unit);
        
        // Add to group
        this.currentCanopyGroup.add(unit);
        
        console.log("Wall-mounted canopy created with 1 unit");
    }

    calculateCanopyPositioning(config, canopyType) {
    // Base measurements - these can be made configurable later
    const baseSpacing = config.length || 15;
    const baseDepthOffset = 22.5; // Average of your 20 and 25 values
    const wallMountZ = 20; // Standard wall-mount position
    
    if (canopyType === 'free-standing') {
        return {
            unit1: {
                x: baseSpacing / 2,
                y: 0,
                z: wallMountZ
            },
            unit2: {
                x: -baseSpacing / 2,
                y: 0,
                z: -baseDepthOffset - 2.5 // Slightly more than your -25
            }
        };
    } else { // wall-mounted
        return {
            unit1: {
                x: baseSpacing / 2,
                y: 0,
                z: wallMountZ
            }
        };
    }
}

    /**
     * Calculate spacing between units for free-standing configuration
     * This will be dynamic based on length/width in future
     */
    calculateUnitSpacing(config) {
        return config.length ? config.length : 15;
    }

    /**
     * Future method: Update canopy positioning based on dimensions
     */
updateCanopyDimensions(config) {
    if (!this.currentCanopyGroup || this.currentCanopyGroup.children.length === 0) return;
    
    // Get NEW positions based on NEW config
    const positioning = this.calculateCanopyPositioning(config, config.canopyType);
    const units = this.currentCanopyGroup.children;
    
    if (config.canopyType === 'free-standing' && units.length === 2) {
        // Move existing units to new positions
        units[0].position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
        units[1].position.set(positioning.unit2.x, positioning.unit2.y, positioning.unit2.z);
    }
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

    setupModelProperties(model) {
        // Set position, scale, rotation as needed
        model.position.y = -25; // Ground level
        model.scale.setScalar(8);
        
        // Enable shadows
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

        // Apply color to all units in the group
        this.currentCanopyGroup.traverse((child) => {
            if (child.isMesh && child.material) {
                if (!child.material.transparent) {
                    child.material.color.setHex(color);
                }
            }
        });
    }

    /**
     * Fallback method if 3D model fails to load
     */
    createFallbackTemplate() {
        console.log("Creating fallback template");
        
        const templateGroup = new THREE.Group();
        
        // Simple geometric representation
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
        console.log("Setting up scene...");
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
        this.camera.position.set(20, 15, 30);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
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
        console.log("Setting up controls...");
        const container = document.getElementById('visualization-area');
    
        // Make it a property of the class (important!)
        this.controls = new OrbitControls(this.camera, container);

        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        this.controls.enableZoom = true;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI / 2;

        // Optional: Focus the camera toward the center
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    setUpLights() {
        console.log("Setting up lights...");

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(20, 30, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-10, 10, -10);
        this.scene.add(fillLight);
    }

    createEnvironment() {
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xd4a574
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -25;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    setUpRender() {
        console.log("Setting up render loop...");
        const animate = () => {
            requestAnimationFrame(animate);
            // this.controls.update();
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