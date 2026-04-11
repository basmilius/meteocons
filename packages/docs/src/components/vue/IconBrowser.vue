<script
    setup
    lang="ts">
    import { useIconBrowserInit } from './composables/useIconBrowser';
    import IconBrowserSidebar from './IconBrowserSidebar.vue';
    import IconBrowserMobileBar from './IconBrowserMobileBar.vue';
    import IconBrowserMobileDrawer from './IconBrowserMobileDrawer.vue';
    import IconBrowserGrid from './IconBrowserGrid.vue';
    import IconBrowserDetail from './IconBrowserDetail.vue';

    useIconBrowserInit();
</script>

<template>
    <div class="browser">
        <IconBrowserSidebar/>
        <IconBrowserMobileBar/>
        <IconBrowserMobileDrawer/>
        <IconBrowserGrid/>
        <IconBrowserDetail/>
    </div>
</template>

<style scoped>
    .browser {
        display: grid;
        grid-template-columns: 300px 1fr;
        min-height: 500px;
    }

    @media (max-width: 768px) {
        .browser {
            grid-template-columns: 1fr;
        }
    }
</style>
