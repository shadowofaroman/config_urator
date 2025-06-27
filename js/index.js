import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";



     // Professional dropdown interaction
        document.addEventListener('DOMContentLoaded', function() {
            const navLinks = document.querySelectorAll('.nav-link');
            const dropdownOptions = document.querySelectorAll('.dropdown-option');

            setTimeout(() => {
                canopy3D = new CanopyConfigurator3D();
            }, 100);
            
            // Tab switching functionality
            navLinks.forEach(link => {
                link.addEventListener('click', function() {
                    // Remove active class from all links
                    navLinks.forEach(l => l.classList.remove('active'));
                    // Add active class to clicked link
                    this.classList.add('active');
                });
            });
            
            // Dropdown option selection
            let canopy3D;
            dropdownOptions.forEach(option => {
                option.addEventListener('click', function() {
                    // Remove selected class from siblings
                    const siblings = this.parentElement.querySelectorAll('.dropdown-option');

                
                    
                    siblings.forEach(sibling => sibling.classList.remove('selected'));
                    // Add selected class to clicked option
                    this.classList.add('selected');
                    
                    // Close dropdown after selection (optional)
                    const dropdown = this.closest('.dropdown-menu');
                    if (dropdown) {
                        dropdown.style.opacity = '0';
                        dropdown.style.visibility = 'hidden';
                        setTimeout(() => {
                            dropdown.style.opacity = '';
                            dropdown.style.visibility = '';
                        }, 300);
                    }
                });
            });
            
            // Form submission
            const submitButton = document.querySelector('.submit-button');
            submitButton.addEventListener('click', function() {
                // Add your form submission logic here
                alert('Configuration submitted! We\'ll contact you with your instant estimate.');
            });
        });


        class CanopyConfigurator3D {
            constructor() {
                console.log("Creating Canopy Configurator 3D instance...");
               
                this.init();
            }

            init() {

                this.setUpScene();
                this.setUpCamera();
                this.setUpRenderer();
                this.setUpRender();
                this.setUpLights();
                this.createCanopyStructure();
                this.createEnvironment();

            }

            setUpScene() {
                console.log("Setting up scene...");
                this.scene = new THREE.Scene();
    
                // Create a gradient background like the reference
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const context = canvas.getContext('2d');
    
                // Create gradient from light gray to white
                const gradient = context.createLinearGradient(0, 0, 0, 512);
                gradient.addColorStop(0, '#f8f8f8');  // Light gray at top
                gradient.addColorStop(1, '#ffffff');  // White at bottom
    
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
                containerRect.width / containerRect.height, // Use container aspect ratio
                0.1, 
                7000
                );
                this.camera.position.set(0, 0, 20);
                this.camera.lookAt(new THREE.Vector3(0, 0, 0));
            }

        setUpRenderer() {
            const canvas = document.getElementById('scene-canvas');
            this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
            });
    
            // Get the container size instead of full window
            const container = document.getElementById('visualization-area');
            const containerRect = container.getBoundingClientRect();
    
            this.renderer.setSize(containerRect.width, containerRect.height);
            this.renderer.setClearColor(0x222222);
    

        }

        setUpRender() {
            console.log("Setting up render loop...");
            const animate = () => {
                requestAnimationFrame(animate);
                if (this.scene.children.length > 2) { // Skip lights
                    const cube = this.scene.children[2]; // Third child should be the cube
                    cube.rotation.x += 0.01;
                    cube.rotation.y += 0.01;
                }
                this.renderer.render(this.scene, this.camera);
            };
            animate();
        }

        setUpLights() {
            console.log("Setting up lights...");
    
        // Soft ambient light
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);

            // Main directional light (like sunlight)
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(20, 30, 20);
            directionalLight.castShadow = true;
            this.scene.add(directionalLight);
    
            // Fill light from opposite side
            const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
            fillLight.position.set(-10, 10, -10);
            this.scene.add(fillLight);
        }

        createCanopyStructure() {
    const canopyGroup = new THREE.Group();
    
    // Frame posts (vertical pillars)
    const postGeometry = new THREE.CylinderGeometry(0.5, 0.5, 25);
    const postMaterial = new THREE.MeshLambertMaterial({ color: 0x2c2c2c });
    
    // Create 4 corner posts
    const positions = [
        [-15, 0, -10], [15, 0, -10], 
        [-15, 0, 10], [15, 0, 10]
    ];
    
    positions.forEach(pos => {
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(pos[0], pos[1], pos[2]);
        canopyGroup.add(post);
    });
    
    // Roof (translucent like glass panels)
    const roofGeometry = new THREE.PlaneGeometry(35, 25);
    const roofMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x87ceeb, 
        transparent: true, 
        opacity: 0.3 
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = 12;
    canopyGroup.add(roof);
    
    this.scene.add(canopyGroup);
}
        createEnvironment() {
        // Ground plane
            const groundGeometry = new THREE.PlaneGeometry(200, 200);
            const groundMaterial = new THREE.MeshLambertMaterial({ 
                color: 0xd4a574  // Tan/wood color like in reference
            });
            const ground = new THREE.Mesh(groundGeometry, groundMaterial);
            ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
            ground.position.y = -25;
            this.scene.add(ground);
        }

    
    }
       
 