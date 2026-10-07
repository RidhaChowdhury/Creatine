// Compatibility alias for the original local verification command.
process.argv.splice(2, 0, 'local', '--web');
await import('./start.mjs');
