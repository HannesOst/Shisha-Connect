// Web variant (browser preview): same Leaflet page, rendered in an iframe instead of a WebView.
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Origin } from '@/lib/bars';
import { colors, radius } from '@/lib/theme';
import type { BarCandidate } from '@/lib/types';
import { BAR_MAP_HTML } from './barMapHtml';

const BRIDGE = '<script>window.ReactNativeWebView={postMessage:function(m){parent.postMessage({source:"bar-map",data:m},"*");}};</script>';
const HTML = BAR_MAP_HTML.replace('<head>', `<head>${BRIDGE}`);

export function BarMap({
  bars,
  origin,
  radiusKm,
  activeKey,
  onSelect,
  height = 320,
}: {
  bars: BarCandidate[];
  origin: Origin | null;
  radiusKm: number;
  activeKey?: string | null;
  onSelect?: (key: string) => void;
  height?: number;
}) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);

  const payload = useMemo(
    () => ({
      origin,
      radiusKm,
      activeKey: activeKey ?? null,
      bars: bars
        .filter((b) => b.lat != null && b.lng != null)
        .map((b) => ({ key: b.key, name: b.name, lat: b.lat, lng: b.lng, source: b.source })),
    }),
    [bars, origin, radiusKm, activeKey],
  );

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.data?.source !== 'bar-map') return;
      const message = JSON.parse(event.data.data);
      if (message.type === 'ready') setReady(true);
      if (message.type === 'select' && onSelect) onSelect(message.key);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [onSelect]);

  useEffect(() => {
    const target = frame.current?.contentWindow as (Window & { setData?: (d: unknown) => void }) | null | undefined;
    if (ready && target?.setData) target.setData(payload);
  }, [ready, payload]);

  return (
    <View style={[styles.container, { height }]}>
      {createElement('iframe', {
        ref: frame,
        srcDoc: HTML,
        style: { border: 0, width: '100%', height: '100%', background: colors.bg },
        title: 'Karte',
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
});
