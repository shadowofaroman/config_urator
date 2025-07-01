/**
 * Create free-standing configuration: Two model instances positioned correctly
 */
createFreeStandingConfiguration(config) {
    console.log("Creating free-standing canopy (2 units)");
    
    const unit1 = this.canopyModelTemplate.clone();
    const unit2 = this.canopyModelTemplate.clone();
    
    // Get dynamic spacing and positioning
    const positioning = this.calculateCanopyPositioning(config, 'free-standing');
    
    // Position units based on calculated values
    unit1.position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
    unit2.position.set(positioning.unit2.x, positioning.unit2.y, positioning.unit2.z);
    
    // Rotate second unit to face the first
    unit2.rotation.y = Math.PI;
    
    this.setupModelProperties(unit1);
    this.setupModelProperties(unit2);
    
    this.currentCanopyGroup.add(unit1);
    this.currentCanopyGroup.add(unit2);
    
    console.log(`Free-standing canopy created: Unit1 at (${positioning.unit1.x}, ${positioning.unit1.z}), Unit2 at (${positioning.unit2.x}, ${positioning.unit2.z})`);
}

/**
 * Create wall-mounted configuration: Single model instance
 */
createWallMountedConfiguration(config) {
    console.log("Creating wall-mounted canopy (1 unit)");
    
    const unit = this.canopyModelTemplate.clone();
    const positioning = this.calculateCanopyPositioning(config, 'wall-mounted');
    
    unit.position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
    
    this.setupModelProperties(unit);
    this.currentCanopyGroup.add(unit);
    
    console.log(`Wall-mounted canopy created at (${positioning.unit1.x}, ${positioning.unit1.z})`);
}

/**
 * Calculate positioning for both canopy types based on configuration
 * This makes the positioning logic reusable and scalable
 */
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
 * Update canopy positioning when dimensions change
 * Now this method can actually reposition existing units
 */
updateCanopyDimensions(config) {
    console.log(`Updating dimensions: L=${config.length}m, W=${config.width}m`);
    
    if (!this.currentCanopyGroup || this.currentCanopyGroup.children.length === 0) return;
    
    const positioning = this.calculateCanopyPositioning(config, config.canopyType);
    const units = this.currentCanopyGroup.children;
    
    if (config.canopyType === 'free-standing' && units.length === 2) {
        // Update positions of both units
        units[0].position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
        units[1].position.set(positioning.unit2.x, positioning.unit2.y, positioning.unit2.z);
        
        console.log(`Updated free-standing positions: Unit1(${positioning.unit1.x}, ${positioning.unit1.z}), Unit2(${positioning.unit2.x}, ${positioning.unit2.z})`);
    } else if (config.canopyType === 'wall-mounted' && units.length === 1) {
        // Update position of single unit
        units[0].position.set(positioning.unit1.x, positioning.unit1.y, positioning.unit1.z);
        
        console.log(`Updated wall-mounted position: (${positioning.unit1.x}, ${positioning.unit1.z})`);
    }
}

/**
 * Calculate spacing between units (simplified since positioning is now centralized)
 */
calculateUnitSpacing(config) {
    return config.length || 15;
}