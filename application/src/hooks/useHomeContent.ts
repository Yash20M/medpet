import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { contentAPI, ApiHomeContent } from '../services/api';
import { mapProduct } from './useCatalog';
import { Product } from '../types/product.types';
import {
  HEALTH_TIPS, BRANDS, TESTIMONIALS, NEARBY_STORES,
  HealthTip, Brand, Testimonial, NearbyStore,
} from '../data/premium';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface HomeContent {
  tips: HealthTip[];
  brands: Brand[];
  testimonials: Testimonial[];
  stores: NearbyStore[];
  flashProducts: Product[];
  etaMins: number;
  flashEndsAt: string | null;
  loaded: boolean;
  reload: () => void;
}

// Bundled fixtures double as the offline / first-paint fallback, so the Home
// screen never renders empty sections while (or if) the API is unreachable.
const FALLBACK: Omit<HomeContent, 'loaded' | 'reload'> = {
  tips: HEALTH_TIPS,
  brands: BRANDS,
  testimonials: TESTIMONIALS,
  stores: NEARBY_STORES,
  flashProducts: [],
  etaMins: 18,
  flashEndsAt: null,
};

const mapContent = (c: ApiHomeContent): Omit<HomeContent, 'loaded' | 'reload'> => ({
  tips: c.tips.map((t) => ({
    id: String(t.id),
    icon: t.icon as IconName,
    tint: [t.color_from, t.color_to] as [string, string],
    title: t.title,
    teaser: t.teaser,
    readMins: t.read_mins,
    sections: t.sections,
  })),
  brands: c.brands.map((b) => ({
    id: String(b.id), name: b.name, emoji: b.emoji, tint: b.tint,
  })),
  testimonials: c.testimonials.map((t) => ({
    id: String(t.id), owner: t.owner_name, petName: t.pet_name,
    petEmoji: t.pet_emoji, rating: t.rating, text: t.body,
  })),
  stores: c.stores.map((s) => ({
    id: String(s.id), name: s.name, area: s.area,
    distanceKm: Number(s.distance_km), etaMins: s.eta_mins, open: s.is_open,
  })),
  flashProducts: c.flash_products.map(mapProduct),
  etaMins: Number(c.settings.delivery_eta_minutes) || 18,
  flashEndsAt: c.settings.flash_sale_ends_at || null,
});

/** Admin-managed Home content, fetched once per mount with pull-to-refresh
 *  support via `reload`. Falls back to bundled fixtures when offline. */
export function useHomeContent(): HomeContent {
  const [content, setContent] = useState(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    contentAPI.home()
      .then((res) => { setContent(mapContent(res.data)); setLoaded(true); })
      .catch(() => { setLoaded(true); /* keep fallback */ });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { ...content, loaded, reload };
}
