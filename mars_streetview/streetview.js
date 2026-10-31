// Mars Street View for Google Maps JS API (custom panoramas).
// Usage:
//   const sv = await initMarsStreetView(map, "/panos");   // map = your google.maps.Map
//   sv.open("bradbury_navcam360");                           // or click a waypoint marker
//
// Tiles are produced by build_panos.py: <base>/<panoId>/<zoom>_<x>_<y>.jpg

export async function initMarsStreetView(map, base = "/panos", { markers = true } = {}) {
  const meta = await (await fetch(`${base}/panos.json`)).json();
  const T = meta.tile;

  function getPanoData(panoId) {
    const p = meta.panos[panoId];
    if (!p) return null;
    return {
      location: {
        pano: p.id,
        description: p.title,
        latLng: new google.maps.LatLng(p.lat, p.lon),
      },
      links: (p.links || []).map(l => ({ pano: l.pano, heading: l.heading, description: l.description })),
      copyright: meta.credit,
      tiles: {
        tileSize: new google.maps.Size(T, T / 2),
        worldSize: new google.maps.Size(p.world_w, p.world_w / 2),
        // Equirect x=0 is north, so the image centre faces south.
        centerHeading: 180,
        getTileUrl: (pano, zoom, x, y) => {
          const z = Math.min(zoom, meta.panos[pano].max_zoom);
          return `${base}/${pano}/${z}_${x}_${y}.jpg`;
        },
      },
    };
  }

  const sv = map.getStreetView();
  sv.registerPanoProvider(getPanoData, { cors: true });
  sv.setOptions({ addressControl: true, linksControl: true, panControl: true, enableCloseButton: true });

  // Stop the stock Earth imagery from ever loading on the Mars map.
  map.setOptions({ streetViewControl: false });

  function open(panoId, heading) {
    const p = meta.panos[panoId];
    sv.setPano(panoId);
    sv.setPov({ heading: heading ?? p.heading ?? 0, pitch: 0 });
    sv.setVisible(true);
  }

  if (markers) {
    for (const p of Object.values(meta.panos)) {
      const m = new google.maps.Marker({
        map, position: { lat: p.lat, lng: p.lon }, title: `${p.title} - Street View`,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#f59e0b",
                fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      m.addListener("click", () => open(p.id));
    }
  }

  return { open, streetView: sv, meta };
}
