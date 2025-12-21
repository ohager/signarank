import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        onConsoleLog(log) {
            if (log.includes('Sourcemap') && log.includes('points to missing source files')) {
                return false
            }
        },
    },
})
