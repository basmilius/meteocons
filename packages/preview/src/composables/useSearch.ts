import { ref, watch } from 'vue';

export function useSearch(debounceMs = 150) {
    const rawQuery = ref('');
    const searchQuery = ref('');

    let timeout: ReturnType<typeof setTimeout> | null = null;

    watch(rawQuery, (value) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            searchQuery.value = value;
        }, debounceMs);
    });

    function clear() {
        rawQuery.value = '';
        searchQuery.value = '';
    }

    return {
        rawQuery,
        searchQuery,
        clear
    };
}
