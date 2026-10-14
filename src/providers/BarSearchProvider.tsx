import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addFavorite, fetchFavorites, fetchGroupBars, removeFavorite } from '@/lib/api';
import { barKey, distanceKm, geocode, sampleBars, searchOsmBars, type Origin } from '@/lib/bars';
import type { BarCandidate } from '@/lib/types';
import { useAuth } from './AuthProvider';

const ORIGIN_KEY = 'shisha.origin';
const RADIUS_KEY = 'shisha.radius';
export const RADIUS_OPTIONS = [1, 2, 5, 10, 25];

type BarSearchContextValue = {
  origin: Origin | null;
  radiusKm: number;
  /** Real (OpenStreetMap) or sample bars plus the group's manually added bars, sorted by distance. */
  results: BarCandidate[];
  favorites: BarCandidate[];
  loading: boolean;
  error: string | null;
  usingSampleData: boolean;
  setRadiusKm: (km: number) => void;
  locateMe: () => Promise<boolean>;
  searchPlace: (query: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  reloadGroupBars: () => Promise<void>;
  isFavorite: (bar: BarCandidate) => boolean;
  toggleFavorite: (bar: BarCandidate) => Promise<void>;
};

const BarSearchContext = createContext<BarSearchContextValue | null>(null);

function withDistance(bar: BarCandidate, origin: Origin | null): BarCandidate {
  if (!origin || bar.lat == null || bar.lng == null) return { ...bar, distanceKm: null };
  return { ...bar, distanceKm: distanceKm(origin, { lat: bar.lat, lng: bar.lng }) };
}

async function loadGroupBars(): Promise<BarCandidate[]> {
  try {
    const bars = await fetchGroupBars();
    return bars.map((b) => ({
      key: barKey(b),
      id: b.id,
      group_id: b.group_id,
      external_id: b.external_id,
      name: b.name,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      opening_hours: b.opening_hours,
      website: b.website,
      phone: b.phone,
      source: b.source,
    }));
  } catch (error) {
    console.warn(error);
    return [];
  }
}

export function BarSearchProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [radiusKm, setRadius] = useState(5);
  const [osmBars, setOsmBars] = useState<BarCandidate[]>([]);
  const [groupBars, setGroupBars] = useState<BarCandidate[]>([]);
  const [favorites, setFavorites] = useState<BarCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const requestId = useRef(0);
  const userId = session?.user.id;

  const reloadGroupBars = useCallback(async () => {
    if (!userId) return;
    setGroupBars(await loadGroupBars());
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadGroupBars().then(setGroupBars);
    fetchFavorites().then(setFavorites).catch(() => undefined);
  }, [userId]);

  const runSearch = useCallback(async (target: Origin, radius: number) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const bars = await searchOsmBars(target, radius);
      if (id !== requestId.current) return;
      setOsmBars(bars);
      setUsingSampleData(false);
    } catch {
      if (id !== requestId.current) return;
      setOsmBars(sampleBars(target));
      setUsingSampleData(true);
      setError('Die Bar-Datenbank (OpenStreetMap) ist gerade nicht erreichbar.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // Restore last location + radius; use the device location silently if already permitted.
  useEffect(() => {
    (async () => {
      const [storedOrigin, storedRadius] = await Promise.all([
        AsyncStorage.getItem(ORIGIN_KEY),
        AsyncStorage.getItem(RADIUS_KEY),
      ]);
      const radius = storedRadius ? Number(storedRadius) : 5;
      let start: Origin | null = storedOrigin ? JSON.parse(storedOrigin) : null;
      const permission = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (permission?.granted && (!start || start.label === 'Mein Standort')) {
        const position = await Location.getLastKnownPositionAsync().catch(() => null);
        if (position) start = { lat: position.coords.latitude, lng: position.coords.longitude, label: 'Mein Standort' };
      }
      setRadius(radius);
      if (start) {
        setOrigin(start);
        runSearch(start, radius);
      }
    })().catch(() => undefined);
  }, [runSearch]);

  const setRadiusKm = useCallback(
    (km: number) => {
      setRadius(km);
      AsyncStorage.setItem(RADIUS_KEY, String(km)).catch(() => undefined);
      if (origin) runSearch(origin, km);
    },
    [origin, runSearch],
  );

  const applyOrigin = useCallback(
    (next: Origin) => {
      setOrigin(next);
      AsyncStorage.setItem(ORIGIN_KEY, JSON.stringify(next)).catch(() => undefined);
      runSearch(next, radiusKm);
    },
    [radiusKm, runSearch],
  );

  const locateMe = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setError('Ohne Standortfreigabe kannst du einen Ort manuell eingeben.');
      return false;
    }
    setLoading(true);
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      applyOrigin({ lat: position.coords.latitude, lng: position.coords.longitude, label: 'Mein Standort' });
      return true;
    } catch {
      setError('Standort konnte nicht ermittelt werden.');
      setLoading(false);
      return false;
    }
  }, [applyOrigin]);

  const searchPlace = useCallback(
    async (query: string) => {
      if (!query.trim()) return false;
      setLoading(true);
      setError(null);
      try {
        const result = await geocode(query.trim());
        if (!result) {
          setError(`„${query}“ wurde nicht gefunden.`);
          setLoading(false);
          return false;
        }
        applyOrigin(result);
        return true;
      } catch {
        setError('Ortssuche ist gerade nicht erreichbar.');
        setLoading(false);
        return false;
      }
    },
    [applyOrigin],
  );

  const refresh = useCallback(async () => {
    await reloadGroupBars();
    if (origin) await runSearch(origin, radiusKm);
  }, [origin, radiusKm, runSearch, reloadGroupBars]);

  const favoriteKeys = useMemo(() => new Set(favorites.map((f) => f.key)), [favorites]);
  const isFavorite = useCallback((bar: BarCandidate) => favoriteKeys.has(bar.key), [favoriteKeys]);

  const toggleFavorite = useCallback(
    async (bar: BarCandidate) => {
      if (favoriteKeys.has(bar.key)) {
        setFavorites((prev) => prev.filter((f) => f.key !== bar.key));
        await removeFavorite(bar.key).catch(() => undefined);
      } else {
        setFavorites((prev) => [...prev, bar]);
        await addFavorite(bar).catch(() => undefined);
      }
    },
    [favoriteKeys],
  );

  const results = useMemo(() => {
    const manual = groupBars
      .map((b) => withDistance(b, origin))
      .filter((b) => b.distanceKm == null || b.distanceKm <= radiusKm);
    return [...osmBars, ...manual].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }, [osmBars, groupBars, origin, radiusKm]);

  const favoritesWithDistance = useMemo(() => favorites.map((f) => withDistance(f, origin)), [favorites, origin]);

  const value = useMemo(
    () => ({
      origin,
      radiusKm,
      results,
      favorites: favoritesWithDistance,
      loading,
      error,
      usingSampleData,
      setRadiusKm,
      locateMe,
      searchPlace,
      refresh,
      reloadGroupBars,
      isFavorite,
      toggleFavorite,
    }),
    [origin, radiusKm, results, favoritesWithDistance, loading, error, usingSampleData, setRadiusKm, locateMe, searchPlace, refresh, reloadGroupBars, isFavorite, toggleFavorite],
  );
  return <BarSearchContext.Provider value={value}>{children}</BarSearchContext.Provider>;
}

export function useBarSearch(): BarSearchContextValue {
  const ctx = useContext(BarSearchContext);
  if (!ctx) throw new Error('useBarSearch must be used inside BarSearchProvider');
  return ctx;
}
