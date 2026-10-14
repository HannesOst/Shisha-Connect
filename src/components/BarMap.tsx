// Map with OpenStreetMap data rendered by Leaflet inside a WebView.
// Works on iOS and Android without any map API key.
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { Origin } from '@/lib/bars';
import { colors, radius } from '@/lib/theme';
import type { BarCandidate } from '@/lib/types';

const HTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;height:100%;background:${colors.bg};}
  .pin{width:18px;height:18px;border-radius:50%;background:${colors.accent};border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.6);}
  .pin.sample{background:${colors.maybe};}
  .pin.manual{background:${colors.amber};}
  .pin.active{transform:scale(1.4);background:#fff;border-color:${colors.accent};}
  .me{width:14px;height:14px;border-radius:50%;background:#4DA3FF;border:3px solid #fff;}
  .leaflet-popup-content{font:600 14px -apple-system,Roboto,sans-serif;}
</style></head>
<body><div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: true });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap-Mitwirkende &copy; CARTO'
  }).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var circle = null;
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }
  window.setData = function(data) {
    layer.clearLayers();
    if (circle) { map.removeLayer(circle); circle = null; }
    var bounds = [];
    if (data.origin) {
      L.marker([data.origin.lat, data.origin.lng], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [20,20] }) }).addTo(layer);
      circle = L.circle([data.origin.lat, data.origin.lng], { radius: data.radiusKm * 1000, color: '${colors.accent}', weight: 1, fillOpacity: 0.05 }).addTo(map);
      bounds.push([data.origin.lat, data.origin.lng]);
    }
    data.bars.forEach(function(b) {
      var cls = 'pin ' + b.source + (b.key === data.activeKey ? ' active' : '');
      var m = L.marker([b.lat, b.lng], { icon: L.divIcon({ className: '', html: '<div class="' + cls + '"></div>', iconSize: [24,24] }) });
      m.bindPopup(esc(b.name) + (b.source === 'sample' ? '<br><i>Beispieldaten</i>' : ''));
      m.on('click', function() { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', key: b.key })); });
      m.addTo(layer);
      bounds.push([b.lat, b.lng]);
    });
    if (circle) map.fitBounds(circle.getBounds(), { padding: [10, 10] });
    else if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    else map.setView([47.3769, 8.5417], 12);
  };
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
</script></body></html>`;

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
        source={{ html: HTML }}
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
