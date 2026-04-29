import { Component, OnInit, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';
import * as proj4 from 'proj4';

@Component({
  selector: 'app-mapa',
  standalone: true,
  template: '<div id="mi-mapa" class="w-full h-full"></div>',
  styles: [`
    #mi-mapa {
      height: 100%;
      width: 100%;
      z-index: 1;
      background-color: #f3f4f6;
    }
  `]
})
export class MapaComponent implements OnInit, AfterViewInit {

  private mapa!: L.Map;
  private capaRuta = new L.FeatureGroup();
  private capaPostes = new L.FeatureGroup();
  private capaCalibrados = new L.FeatureGroup();
  private lineaRuta: L.Polyline | null = null;
  private marcadorActual: L.Marker | null = null;
  private marcadorVideo: L.Marker | null = null;
  private rutaVideo: Array<{ lat: number; lng: number; t: number }> = [];

  private utm = "";
  private wgs84 = "+proj=longlat +datum=WGS84 +no_defs";

  ngOnInit(): void {
    this.iniciarMapa();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.mapa.invalidateSize(), 100);
  }

  private iniciarMapa(): void {
    this.mapa = L.map('mi-mapa').setView([-13.6186, -74.6547], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 20
    }).addTo(this.mapa);

    this.mapa.addLayer(this.capaRuta);
    this.mapa.addLayer(this.capaPostes);
    this.mapa.addLayer(this.capaCalibrados);
    this.limpiarMarcadoresLegacy();
  }

  cargarKMLDinamico(kmlText: string): void {
    try {
      this.capaRuta.clearLayers();
      this.limpiarMarcadoresLegacy();
      const doc = new DOMParser().parseFromString(kmlText, 'text/xml');
      const coordsTags = doc.getElementsByTagName("coordinates");
      let latlngs: L.LatLng[] = [];

      Array.from(coordsTags).forEach(tag => {
        const coords = tag.textContent?.trim().split(/\s+/) || [];
        coords.forEach(c => {
          const parts = c.split(',');
          if (parts.length >= 2) {
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lon)) {
              latlngs.push(new L.LatLng(lat, lon));
            }
          }
        });
      });

      if (latlngs.length === 0) return;

      this.detectarZonaUTM(latlngs[0].lng, latlngs[0].lat);

      this.lineaRuta = L.polyline(latlngs, {
        color: '#2563eb',
        weight: 5
      });

      this.capaRuta.addLayer(this.lineaRuta);
      this.mapa.fitBounds(this.lineaRuta.getBounds());
      console.log("✅ Ruta dibujada correctamente.");

    } catch (err) {
      console.error("Error KML Eje:", err);
    }
  }

  private limpiarMarcadoresLegacy() {
    if (!this.mapa) return;
    const layers: Record<string, any> = (this.mapa as any)._layers ?? {};
    for (const key of Object.keys(layers)) {
      const layer = layers[key];
      const icon = layer?.options?.icon;
      const className = icon?.options?.className;
      const html = icon?.options?.html;
      const isMarker = layer instanceof L.Marker;
      const isDivIcon = icon instanceof L.DivIcon;
      const isUtmPointer = typeof className === 'string' && className.includes('utm-pointer');

      if (isMarker && isDivIcon && !isUtmPointer) {
        this.mapa.removeLayer(layer);
        continue;
      }

      if (typeof className === 'string' && (className.includes('car-marker') || className.includes('nav-pointer'))) {
        this.mapa.removeLayer(layer);
        continue;
      }
      if (typeof html === 'string' && (html.includes('nav-pointer') || html.includes('car-marker'))) {
        this.mapa.removeLayer(layer);
      }
    }
    document.querySelectorAll('.car-marker, .nav-pointer').forEach((el) => el.remove());
  }

  setRutaVideo(
    ruta: Array<{ lat: number; lng: number; tiempo_video_s: number }>,
    postesCalibrados?: Array<{ x: string | number; y: string | number; time: string | number }>
  ) {
    let base = (ruta ?? [])
      .map((p) => ({ lat: p.lat, lng: p.lng, t: Number(p.tiempo_video_s) }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);

    const hint = this.getStartHintLatLng(postesCalibrados);
    if (hint && base.length >= 2) {
      const start = new L.LatLng(base[0].lat, base[0].lng);
      const end = new L.LatLng(base[base.length - 1].lat, base[base.length - 1].lng);
      const dStart = hint.distanceTo(start);
      const dEnd = hint.distanceTo(end);
      if (dEnd < dStart) {
        const tMin = base[0].t;
        const tMax = base[base.length - 1].t;
        const mirror = (t: number) => tMin + tMax - t;
        base = base.slice().reverse().map((p) => ({ ...p, t: mirror(p.t) })).sort((a, b) => a.t - b.t);
      }
    }

    this.rutaVideo = base;
    this.marcadorVideo?.remove();
    this.marcadorVideo = null;
  }

  private getStartHintLatLng(postesCalibrados?: Array<{ x: string | number; y: string | number; time: string | number }>) {
    if (!postesCalibrados || postesCalibrados.length < 1 || !this.utm) return null;
    const valid = postesCalibrados
      .map((p) => ({ x: Number(p.x), y: Number(p.y), time: Number(p.time) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.time) && p.time > 0)
      .sort((a, b) => a.time - b.time);
    if (valid.length < 1) return null;
    try {
      const [lat, lng] = this.convertUTMToLatLng(valid[0].x, valid[0].y);
      const snapped = this.lineaRuta ? this.getClosestPointOnLine(new L.LatLng(lat, lng)) : new L.LatLng(lat, lng);
      return snapped;
    } catch {
      return null;
    }
  }

  actualizarPunteroPorVideo(t: number) {
    if (!this.mapa || this.rutaVideo.length === 0) return;
    const p = this.interpolarPorTiempo(t);
    if (!p) return;
    const latlng = new L.LatLng(p.lat, p.lng);
    if (!this.marcadorVideo) {
      this.marcadorVideo = L.marker(latlng, {
        icon: L.divIcon({
          className: 'video-pointer',
          html: '<div style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:20px solid #2563eb;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transform:translate(-10px,-10px);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
      }).addTo(this.mapa);
    } else {
      this.marcadorVideo.setLatLng(latlng);
    }
  }

  private interpolarPorTiempo(t: number): { lat: number; lng: number } | null {
    if (this.rutaVideo.length === 1) return { lat: this.rutaVideo[0].lat, lng: this.rutaVideo[0].lng };
    const first = this.rutaVideo[0];
    const last = this.rutaVideo[this.rutaVideo.length - 1];
    if (t <= first.t) return { lat: first.lat, lng: first.lng };
    if (t >= last.t) return { lat: last.lat, lng: last.lng };
    for (let i = 0; i < this.rutaVideo.length - 1; i++) {
      const a = this.rutaVideo[i];
      const b = this.rutaVideo[i + 1];
      if (t >= a.t && t <= b.t) {
        const dt = b.t - a.t;
        const r = dt > 0 ? (t - a.t) / dt : 0;
        return { lat: a.lat + (b.lat - a.lat) * r, lng: a.lng + (b.lng - a.lng) * r };
      }
    }
    return null;
  }

  dibujarPostes(postes: any[]) {
    console.log(`🔥 Recibida la orden de dibujar ${postes.length} postes.`);

    if (!this.lineaRuta) {
      console.warn("⚠️ No hay ruta cargada. Carga el Eje de Vía primero.");
      return;
    }

    this.capaPostes.clearLayers();
    const proyectados: any[] = [];

    postes.forEach(p => {
      try {
        const [lat, lng] = this.convertUTMToLatLng(+p.x, +p.y);
        if (isNaN(lat) || isNaN(lng)) return;

        const original = new L.LatLng(lat, lng);
        const snapped = this.getClosestPointOnLine(original);
        const dist = this.getDistanceAlongRoute(snapped);

        proyectados.push({ ...p, latlng: snapped, dist });
      } catch (err) {
        console.error("Error proyectando poste:", p, err);
      }
    });

    proyectados.sort((a, b) => a.dist - b.dist);

    proyectados.forEach((p, i) => {
      L.circleMarker(p.latlng, {
        radius: 6,
        fillColor: "#f97316",
        color: "#fff",
        weight: 2,
        fillOpacity: 1
      }).addTo(this.capaPostes).bindPopup(`Poste ${i + 1}`);
    });

    if (proyectados.length > 0) {
      this.mapa.fitBounds(this.capaPostes.getBounds(), { padding: [50, 50] });
      console.log("📍 Postes dibujados exitosamente.");
    }
  }

  dibujarPostesCalibrados(postes: Array<{ id: number; x: string | number; y: string | number; time: string | number }>) {
    if (!this.lineaRuta || !this.utm) return;

    this.capaCalibrados.clearLayers();

    const calibrados = postes
      .map((p) => ({ ...p, timeN: Number(p.time), xN: Number(p.x), yN: Number(p.y) }))
      .filter((p) => Number.isFinite(p.timeN) && p.timeN > 0 && Number.isFinite(p.xN) && Number.isFinite(p.yN));

    const proyectados = calibrados.map((p) => {
      const [lat, lng] = this.convertUTMToLatLng(p.xN, p.yN);
      const snapped = this.getClosestPointOnLine(new L.LatLng(lat, lng));
      const dist = this.getDistanceAlongRoute(snapped);
      return { ...p, snapped, dist };
    }).sort((a, b) => a.dist - b.dist);

    const latlngsLinea: L.LatLng[] = [];

    proyectados.forEach((p, idx) => {
      latlngsLinea.push(p.snapped);
      L.circleMarker(p.snapped, {
        radius: 7,
        fillColor: "#22c55e",
        color: "#ffffff",
        weight: 2,
        fillOpacity: 1
      })
        .addTo(this.capaCalibrados)
        .bindTooltip(`#${p.id}  t=${p.timeN.toFixed(2)}s`, { permanent: false, direction: 'top' });
    });

    if (latlngsLinea.length >= 2) {
      L.polyline(latlngsLinea, { color: '#22c55e', weight: 4, opacity: 0.9 }).addTo(this.capaCalibrados);
    }
  }

  moverMarcadorSimulado(x: number, y: number) {
    if(!this.utm) return;
    try {
      const [lat, lng] = this.convertUTMToLatLng(x, y);
      let punto = new L.LatLng(lat, lng);

      if (this.lineaRuta) {
          punto = this.getClosestPointOnLine(punto);
      }

      if (this.marcadorActual) {
        this.mapa.removeLayer(this.marcadorActual);
      }

      this.marcadorActual = L.marker(punto, {
        icon: L.divIcon({
          className: 'utm-pointer',
          html: '<div style="width:14px;height:14px;background:#ef4444;border:2px solid #fff;border-radius:999px;box-shadow:0 0 0 2px #b91c1c;"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
      }).addTo(this.mapa);
      this.mapa.setView(punto, 17);
    } catch(err) {}
  }

  private detectarZonaUTM(lon: number, lat: number) {
    const zone = Math.floor((lon + 180) / 6) + 1;
    const south = lat < 0;
    this.utm = `+proj=utm +zone=${zone} ${south ? '+south' : ''} +datum=WGS84 +units=m +no_defs`;
  }

  private convertUTMToLatLng(x: number, y: number): [number, number] {
    // 🔥 Parche de seguridad
    const proj4Fn = (proj4 as any).default || proj4;
    const [lng, lat] = proj4Fn(this.utm, this.wgs84, [x, y]);
    return [lat, lng];
  }

  // (Las funciones de matemáticas de snap se mantienen idénticas)
  private getClosestPointOnLine(p: L.LatLng): L.LatLng {
    const latlngs = this.lineaRuta!.getLatLngs() as L.LatLng[];
    let closest = p;
    let minDist = Infinity;
    for (let i = 0; i < latlngs.length - 1; i++) {
      const candidate = this.projectPointOnSegment(p, latlngs[i], latlngs[i + 1]);
      const dist = p.distanceTo(candidate);
      if (dist < minDist) { minDist = dist; closest = candidate; }
    }
    return closest;
  }

  private projectPointOnSegment(p: L.LatLng, p1: L.LatLng, p2: L.LatLng): L.LatLng {
    const A = p.lng - p1.lng; const B = p.lat - p1.lat;
    const C = p2.lng - p1.lng; const D = p2.lat - p1.lat;
    const dot = A * C + B * D; const lenSq = C * C + D * D;
    let t = dot / lenSq; t = Math.max(0, Math.min(1, t));
    return new L.LatLng(p1.lat + t * (p2.lat - p1.lat), p1.lng + t * (p2.lng - p1.lng));
  }

  private getDistanceAlongRoute(point: L.LatLng): number {
    const latlngs = this.lineaRuta!.getLatLngs() as L.LatLng[];
    let total = 0; let best = 0; let minDist = Infinity;
    for (let i = 0; i < latlngs.length - 1; i++) {
      const p1 = latlngs[i]; const p2 = latlngs[i + 1];
      const segDist = p1.distanceTo(p2);
      const proj = this.projectPointOnSegment(point, p1, p2);
      const d = point.distanceTo(proj);
      if (d < minDist) { minDist = d; best = total + p1.distanceTo(proj); }
      total += segDist;
    }
    return best;
  }
}
