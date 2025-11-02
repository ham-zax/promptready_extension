#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to exclude
const EXCLUDED_DIRS = ['.git', 'node_modules', '.git', '.svn', '__pycache__', '.venv', 'venv', '.env', 'dist', 'build', '.next', '.nuxt', '.cache', 'coverage', '.nyc_output'];

/**
 * Recursively walks through directory structure
 * @param {string} dirPath - Current directory path
 * @param {string} prefix - Current prefix for tree structure
 * @param {Array<string>} results - Array to store results
 * @param {number} maxDepth - Maximum depth to traverse
 * @param {number} currentDepth - Current depth level
 */
function walkDirectory(dirPath, prefix = '', results = [], maxDepth = 10, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
        return results;
    }

    let items;
    try {
        items = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (error) {
        return results;
    }

    // Filter out excluded directories and sort items
    const filteredItems = items.filter(item => {
        const shouldExclude = EXCLUDED_DIRS.some(excluded => 
            item.name.toLowerCase().includes(excluded.toLowerCase())
        );
        return !shouldExclude && !item.name.startsWith('.');
    }).sort((a, b) => {
        // Directories first, then files
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });

    filteredItems.forEach((item, index) => {
        const itemPath = path.join(dirPath, item.name);
        const isLast = index === filteredItems.length - 1;
        const currentPrefix = isLast ? '└── ' : '├── ';
        
        results.push(prefix + currentPrefix + item.name);
        
        if (item.isDirectory()) {
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            walkDirectory(itemPath, nextPrefix, results, maxDepth, currentDepth + 1);
        }
    });
    
    return results;
}

/**
 * Main function to generate tree structure
 * @param {string} startPath - Starting directory path
 * @param {Object} options - Options for tree generation
 */
function generateTree(startPath = '.', options = {}) {
    const { maxDepth = 10 } = options;

    const tree = [];
    
    // Add root directory
    const rootName = path.basename(path.resolve(startPath));
    tree.push(rootName);
    
    // Generate tree structure
    const lines = walkDirectory(startPath, '', [], maxDepth, 0);
    
    return tree.concat(lines).join('\n');
}

// CLI handling
const args = process.argv.slice(2);
const options = {
    maxDepth: 10
};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
        case '-d':
        case '--depth':
            options.maxDepth = parseInt(args[++i]) || 10;
            break;
        case '-h':
        case '--help':
            console.log(`
Tree Command - Directory Structure Viewer

Usage: node tree.js [options] [path]

Options:
  -d, --depth <number>    Maximum depth to traverse (default: 10)
  -h, --help             Show this help message

Examples:
  node tree.js                     # Show current directory structure
  node tree.js -d 3               # Show structure with max depth of 3
  node tree.js ./src              # Show structure of src directory
            `);
            process.exit(0);
            break;
        case '-a':
        case '--all':
            // Show hidden files (not excluding .items)
            break;
    }
}

const startPath = args.find(arg => !arg.startsWith('-')) || '.';

try {
    const treeOutput = generateTree(startPath, options);
    console.log(treeOutput);
} catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
}