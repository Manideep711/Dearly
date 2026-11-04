import {defineConfig} from 'vite';
// Relative base so the same build works at a domain root and under a
// GitHub Pages project path (e.g. /dearly/). Runtime asset paths in the
// code are prefixed with import.meta.env.BASE_URL for the same reason.
export default defineConfig({base: './'});
