import 'dotenv/config';

console.log('Basic usage:');
await import('./basic-usage.js');

console.log();

console.log('Hierarchical usage:');
await import('./hierarchical-usage.js');

console.log();

console.log('Using your framework:');
await import('./using-your-framework.js');
