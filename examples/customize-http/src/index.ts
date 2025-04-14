import 'dotenv/config';

console.group('Using a custom Undici Dispatcher:');
await import('./01-custom-fetch-agent.js');
console.groupEnd();

console.log();

console.group('Using a custom Axios fetcher implementation:');
await import('./02-custom-axios-impl.js');
console.groupEnd();

console.log();

console.group('Polyfilling fetch:');
await import('./03-polyfill-node-fetch.js');
console.groupEnd();
