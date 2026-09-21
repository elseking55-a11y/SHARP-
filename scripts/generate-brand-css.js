const fs = require('fs');
const path = require('path');

// Import brand configuration from project root
const brandConfig = require('../brand.config.json');

// Main function to update brand colors in _themes.scss
const updateBrandColorsInThemes = () => {
    const themesPath = path.join(__dirname, '../src/components/shared/styles/_themes.scss');

    if (!fs.existsSync(themesPath)) {
        console.error('❌ _themes.scss file not found');
        process.exit(1);
    }

    // Read the current themes file
    let themesContent = fs.readFileSync(themesPath, 'utf8');
    const originalContent = themesContent;

    // Extract colors and typography from brand config
    const { colors, typography } = brandConfig;

    // Generate brand color variables from config
    const brandColorLines = [
        '    /* Brand colors - dynamically generated from brand.config.json */',
        `    --brand-white: ${colors.white};`,
        `    --brand-dark-grey: ${colors.black};`,
        `    --brand-red-coral: ${colors.primary}; /* legacy compatibility */`,
        `    --brand-orange: ${colors.tertiary}; /* legacy compatibility */`,
        '',
        '    /* Dynamic brand colors (set by brand configuration) */',
        `    --brand-primary: ${colors.primary};`,
        `    --brand-secondary: ${colors.secondary};`,
        `    --brand-tertiary: ${colors.tertiary};`,
        `    --brand-success: ${colors.success};`,
        `    --brand-danger: ${colors.danger};`,
        `    --brand-warning: ${colors.warning};`,
        `    --brand-info: ${colors.info};`,
        `    --brand-neutral: ${colors.neutral};`,
    ];

    // Generate typography variables if available
    if (typography && typography.font_family) {
        brandColorLines.push('');
        brandColorLines.push('    /* Brand typography - dynamically generated from brand.config.json */');
        brandColorLines.push(`    --brand-font-primary: ${typography.font_family.primary};`);
        brandColorLines.push(`    --brand-font-secondary: ${typography.font_family.secondary};`);
        brandColorLines.push(`    --brand-font-monospace: ${typography.font_family.monospace};`);
    }

    // Replace the complete generated brand section.
    // This prevents duplicate variables when the generator runs repeatedly.
    const brandStartMarker = '    /* Brand colors - dynamically generated from brand.config.json */';
    const appCardsMarker = '    // App Cards gradient background';
    const insertionPoint = themesContent.indexOf(brandStartMarker);
    const endPoint = themesContent.indexOf(appCardsMarker, insertionPoint);

    if (insertionPoint === -1 || endPoint === -1) {
        console.error('❌ Could not find the generated brand section boundaries in _themes.scss');
        process.exit(1);
    }

    const beforeSection = themesContent.substring(0, insertionPoint);
    const afterSection = themesContent.substring(endPoint);

    themesContent = beforeSection + brandColorLines.join('\n') + '\n\n' + afterSection;

    // Write the updated file
    fs.writeFileSync(themesPath, themesContent, 'utf8');

    // Check if changes were made
    const hasChanges = originalContent !== themesContent;

    if (hasChanges) {
        console.log('✅ Brand styling updated successfully in _themes.scss!');
        console.log(`📁 Updated: ${themesPath}`);
        console.log('📊 Changes made:');
        console.log('   Colors:');
        console.log(`      • Brand White: ${colors.white}`);
        console.log(`      • Brand Dark Grey: ${colors.black}`);
        console.log(`      • Primary: ${colors.primary}`);
        console.log(`      • Secondary: ${colors.secondary}`);
        console.log(`      • Tertiary: ${colors.tertiary}`);
        console.log(`      • Success: ${colors.success}`);
        console.log(`      • Danger: ${colors.danger}`);
        console.log(`      • Warning: ${colors.warning}`);
        console.log(`      • Info: ${colors.info}`);
        if (typography && typography.font_family) {
            console.log('   Typography:');
            console.log(`      • Primary Font: ${typography.font_family.primary.substring(0, 50)}...`);
            console.log(`      • Secondary Font: ${typography.font_family.secondary}`);
            console.log(`      • Monospace Font: ${typography.font_family.monospace}`);
        }
    } else {
        console.log('✓ No changes needed - brand styling already up to date');
    }

    return hasChanges;
};

// Validation function
const validateBrandConfig = () => {
    const issues = [];

    if (!brandConfig.colors) {
        issues.push('Missing colors configuration in brand.config.json');
    } else {
        const requiredColors = [
            'primary',
            'secondary',
            'tertiary',
            'success',
            'danger',
            'warning',
            'info',
            'neutral',
            'white',
            'black',
        ];
        requiredColors.forEach(color => {
            if (!brandConfig.colors[color]) {
                issues.push(`Missing required color: ${color}`);
            }
        });
    }

    // Optional typography validation (warnings only)
    if (brandConfig.typography) {
        if (!brandConfig.typography.font_family) {
            console.warn('⚠️  Typography configuration found but font_family is missing');
        } else {
            const requiredFonts = ['primary', 'secondary', 'monospace'];
            requiredFonts.forEach(font => {
                if (!brandConfig.typography.font_family[font]) {
                    console.warn(`⚠️  Missing recommended font: ${font}`);
                }
            });
        }
    }

    if (issues.length > 0) {
        console.error('❌ Brand configuration issues:');
        issues.forEach(issue => console.error(`  - ${issue}`));
        process.exit(1);
    }

    console.log('✅ Brand configuration is valid');
    return true;
};

// Add script to package.json if it doesn't exist
const addPackageScript = () => {
    const packageJsonPath = path.join(__dirname, '../package.json');

    if (!fs.existsSync(packageJsonPath)) {
        console.log('⚠️  package.json not found, skipping script addition');
        return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    if (!packageJson.scripts) {
        packageJson.scripts = {};
    }

    if (!packageJson.scripts['generate:brand-css']) {
        packageJson.scripts['generate:brand-css'] = 'node scripts/generate-brand-css.js';
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
        console.log('✅ Added "generate:brand-css" script to package.json');
    }
};

// Main execution
if (require.main === module) {
    console.log('🎨 Updating brand colors in _themes.scss...\n');

    validateBrandConfig();
    const hasChanges = updateBrandColorsInThemes();
    addPackageScript();

    console.log('\n🎯 Next steps:');
    if (hasChanges) {
        console.log('1. The brand colors in _themes.scss have been updated with AI markers');
        console.log('2. To regenerate: npm run generate:brand-css');
        console.log('3. Restart your dev server to see the changes');
    } else {
        console.log('1. No changes were needed');
        console.log('2. To force regeneration: npm run generate:brand-css');
    }
}

module.exports = {
    updateBrandColorsInThemes,
    validateBrandConfig,
};
