import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@lib': path.resolve(__dirname, 'lib'),
            '@hooks': path.resolve(__dirname, 'hooks'),
            '@components': path.resolve(__dirname, 'components'),
            '@states': path.resolve(__dirname, 'states'),
        },
    },
    test: {
        globals: false,
    },
});
