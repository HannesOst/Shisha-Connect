// Leaflet page shared by the native (WebView) and web (iframe) map.
import { colors } from '@/lib/theme';

export const BAR_MAP_HTML = `<!DOCTYPE html>
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
    // Bounds from the radius itself: circle.getBounds() needs a map view that may not exist yet.
    if (data.origin) map.fitBounds(L.latLng(data.origin.lat, data.origin.lng).toBounds(data.radiusKm * 2000), { padding: [10, 10] });
    else if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    else map.setView([47.3769, 8.5417], 12);
  };
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
</script></body></html>`;
