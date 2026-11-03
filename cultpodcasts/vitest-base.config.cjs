/** @type {import('vitest/config').UserConfig} */
module.exports = {
  test: {
    // Avoid Vitest forks pool timeouts when spawning many Windows workers.
    pool: 'threads',
    maxWorkers: 2,
    // Registers app SVG icons + quiet YouTube iframe loads (see file header).
    setupFiles: ['./src/testing/vitest-setup.ts'],
    // Prefer navigation off for any non-YouTube iframes too (happy-dom child frames).
    environmentOptions: {
      happyDOM: {
        settings: {
          navigation: {
            disableChildFrameNavigation: true,
          },
        },
      },
    },
  },
};
