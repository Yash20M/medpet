import { MAPPLS_STATIC_KEY } from '../../config/mappls';

// The SDK attaches itself here once loaded.
declare global {
  interface Window { mappls?: any }
}

let mapplsPromise: Promise<any> | null = null;

/**
 * Load the Mappls Web Maps JS SDK exactly once (script-tag injection, not an
 * npm package — that's how Mappls ships v3). Safe under React StrictMode's
 * double-effect: a second call while the first is still loading reuses the
 * same in-flight promise instead of injecting a second <script>.
 */
export const loadMappls = (): Promise<any> => {
  if (window.mappls) return Promise.resolve(window.mappls);
  if (mapplsPromise) return mapplsPromise;

  const key = MAPPLS_STATIC_KEY;
  if (!key) {
    return Promise.reject(new Error('VITE_MAPPLS_STATIC_KEY is missing — set it in admin-web/.env'));
  }

  mapplsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-mappls-sdk="true"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.mappls) resolve(window.mappls);
        else reject(new Error('Mappls SDK loaded but window.mappls is unavailable'));
      });
      existing.addEventListener('error', () => reject(new Error('Failed to load Mappls SDK')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(key)}`;
    script.async = true;
    script.dataset.mapplsSdk = 'true';
    script.onload = () => {
      if (window.mappls) resolve(window.mappls);
      else reject(new Error('Mappls SDK loaded but window.mappls is unavailable'));
    };
    script.onerror = () => reject(new Error('Failed to load Mappls SDK'));
    document.head.appendChild(script);
  });

  return mapplsPromise;
};
