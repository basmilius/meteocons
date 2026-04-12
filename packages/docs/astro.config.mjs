// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vue from '@astrojs/vue';

export default defineConfig({
    site: 'https://meteocons.com',
    integrations: [vue(), mdx(), sitemap({ filter: (page) => !page.includes('/qa') })],
    markdown: {
        shikiConfig: {
            theme: 'github-dark',
        },
    },
});
