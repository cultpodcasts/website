/** @type {import('vitest/config').UserConfig} */
module.exports = {
  test: {
    // Avoid Vitest forks pool timeouts when spawning many Windows workers.
    pool: 'threads',
    maxWorkers: 2,
  },
};
