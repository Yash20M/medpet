/** Mappls (MapmyIndia) Web Maps JS static key — browser-safe, restricted by domain in the Mappls console. */
export const MAPPLS_STATIC_KEY = import.meta.env.VITE_MAPPLS_STATIC_KEY as string | undefined;

export const hasMapplsKey = (): boolean => Boolean(MAPPLS_STATIC_KEY);
