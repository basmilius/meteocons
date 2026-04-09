<script
    setup
    lang="ts">
    const model = defineModel<string>({required: true});
</script>

<template>
    <div class="search-wrap">
        <svg
            class="search-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round">
            <circle
                cx="11"
                cy="11"
                r="8"/>
            <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"/>
        </svg>
        <input
            :value="model"
            type="search"
            placeholder="Search icons..."
            autocomplete="off"
            @input="model = ($event.target as HTMLInputElement).value"
        >
    </div>
</template>

<style scoped>
    .search-wrap {
        position: relative;
        display: flex;
        align-items: center;
    }

    .search-icon {
        position: absolute;
        left: 10px;
        color: var(--text-muted);
        pointer-events: none;
    }

    input {
        padding: 7px 10px 7px 30px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        font-size: 12px;
        font-family: inherit;
        width: 200px;
        outline: none;
        background: var(--bg);
        color: var(--text);
        transition: all 0.15s;
    }

    input:focus {
        border-color: var(--accent);
        background: var(--surface);
        box-shadow: 0 0 0 3px var(--accent-bg);
    }

    input::placeholder {
        color: var(--text-muted);
    }
</style>
