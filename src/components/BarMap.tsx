// Map with OpenStreetMap data rendered by Leaflet inside a WebView.
// Works on iOS and Android without any map API key.
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { Origin } from '@/lib/bars';
import { colors, radius } from '@/lib/theme';
import type { BarCandidate } from '@/lib/types';
import { BAR_MAP_HTML } from './barMapHtml';

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
  const webView = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const payload = useMemo(
    () =>
      JSON.stringify({
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
    if (ready) webView.current?.injectJavaScript(`window.setData(${payload}); true;`);
  }, [ready, payload]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') setReady(true);
      if (message.type === 'select' && onSelect) onSelect(message.key);
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webView}
        originWhitelist={['*']}
        source={{ html: BAR_MAP_HTML }}
        onMessage={onMessage}
        style={{ backgroundColor: colors.bg }}
        javaScriptEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
});
