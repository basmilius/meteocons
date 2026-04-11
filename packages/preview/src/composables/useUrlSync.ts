export function getUrlParam(key: string): string | null {
    try {
        return new URLSearchParams(window.location.search).get(key);
    } catch {
        return null;
    }
}

export function setUrlParam(key: string, value: string | null): void {
    try {
        const params = new URLSearchParams(window.location.search);

        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }

        const query = params.toString();
        const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
        history.replaceState(null, '', url);
    } catch {
        // SSR or no window
    }
}
