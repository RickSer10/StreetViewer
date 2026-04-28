import { Component, OnInit, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';
import proj4 from 'proj4';

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

  private lineaRuta: L.Polyline | null = null;
  private marcadorActual: L.Marker | null = null;

  private utm = "";
  private wgs84 = "+proj=longlat +datum=WGS84 +no_defs";

  ngOnInit(): void {
    this.iniciarMapa();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.mapa.invalidateSize(), 100);
  }

  // ---------------- MAPA ----------------
  private iniciarMapa(): void {
    this.mapa = L.map('mi-mapa').setView([-13.6186, -74.6547], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 20
    }).addTo(this.mapa);

    this.mapa.addLayer(this.capaRuta);
    this.mapa.addLayer(this.capaPostes);
  }

  // ---------------- KML (RUTA REAL) ----------------
  cargarKMLDinamico(kmlText: string): void {
    try {
      this.capaRuta.clearLayers();

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

      if (latlngs.length === 0) {
        console.error("❌ KML sin coordenadas");
        return;
      }

      // 🔥 detectar zona UTM automáticamente
      this.detectarZonaUTM(latlngs[0].lng, latlngs[0].lat);

      this.lineaRuta = L.polyline(latlngs, {
        color: '#2563eb',
        weight: 5
      });

      this.capaRuta.addLayer(this.lineaRuta);

      this.mapa.fitBounds(this.lineaRuta.getBounds());

      console.log("✅ Ruta cargada:", latlngs.length, "puntos");

    } catch (err) {
      console.error("Error KML:", err);
    }
  }

  // ---------------- DETECTAR UTM ----------------
  private detectarZonaUTM(lon: number, lat: number) {
    const zone = Math.floor((lon + 180) / 6) + 1;
    const south = lat < 0;

    this.utm = `+proj=utm +zone=${zone} ${south ? '+south' : ''} +datum=WGS84 +units=m +no_defs`;

    console.log("🌍 UTM detectado:", this.utm);
  }

  // ---------------- POSTES ----------------
  dibujarPostes(postes: any[]) {
  console.log("🔥 dibujarPostes ejecutado");
  console.log("📦 postes:", postes);

  if (!this.lineaRuta) {
    console.warn("⚠️ Ruta no cargada");
    return;
  }

  this.capaPostes.clearLayers();

    const proyectados: any[] = [];

    postes.forEach(p => {
      const [lat, lng] = this.convertUTMToLatLng(+p.x, +p.y);

      if (isNaN(lat) || isNaN(lng)) return;

      const original = new L.LatLng(lat, lng);

      const snapped = this.getClosestPointOnLine(original);
      const dist = this.getDistanceAlongRoute(snapped);

      proyectados.push({
        ...p,
        latlng: snapped,
        dist
      });
    });

    // 🔥 ordenar
    proyectados.sort((a, b) => a.dist - b.dist);

    console.log("📍 Postes proyectados:", proyectados.length);

    proyectados.forEach((p, i) => {
      L.circleMarker(p.latlng, {
        radius: 6,
        fillColor: "#f97316",
        color: "#fff",
        weight: 2,
        fillOpacity: 1
      })
        .addTo(this.capaPostes)
        .bindPopup(`Poste ${i + 1}`);
    });

    if (proyectados.length > 0) {
      this.mapa.fitBounds(this.capaPostes.getBounds(), { padding: [50, 50] });
    }
  }

  // ---------------- CONVERSION ----------------
  private convertUTMToLatLng(x: number, y: number): [number, number] {
    const [lng, lat] = proj4(this.utm, this.wgs84, [x, y]);
    return [lat, lng];
  }

  // ---------------- SNAP ----------------
  private getClosestPointOnLine(p: L.LatLng): L.LatLng {
    const latlngs = this.lineaRuta!.getLatLngs() as L.LatLng[];

    let closest = p;
    let minDist = Infinity;

    for (let i = 0; i < latlngs.length - 1; i++) {
      const candidate = this.projectPointOnSegment(p, latlngs[i], latlngs[i + 1]);
      const dist = p.distanceTo(candidate);

      if (dist < minDist) {
        minDist = dist;
        closest = candidate;
      }
    }

    return closest;
  }

  private projectPointOnSegment(p: L.LatLng, p1: L.LatLng, p2: L.LatLng): L.LatLng {
    const A = p.lng - p1.lng;
    const B = p.lat - p1.lat;
    const C = p2.lng - p1.lng;
    const D = p2.lat - p1.lat;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    let t = dot / lenSq;
    t = Math.max(0, Math.min(1, t));

    return new L.LatLng(
      p1.lat + t * (p2.lat - p1.lat),
      p1.lng + t * (p2.lng - p1.lng)
    );
  }

  // ---------------- DISTANCIA SOBRE RUTA ----------------
  private getDistanceAlongRoute(point: L.LatLng): number {
    const latlngs = this.lineaRuta!.getLatLngs() as L.LatLng[];

    let total = 0;
    let best = 0;
    let minDist = Infinity;

    for (let i = 0; i < latlngs.length - 1; i++) {
      const p1 = latlngs[i];
      const p2 = latlngs[i + 1];

      const segDist = p1.distanceTo(p2);

      const proj = this.projectPointOnSegment(point, p1, p2);
      const d = point.distanceTo(proj);

      if (d < minDist) {
        minDist = d;
        best = total + p1.distanceTo(proj);
      }

      total += segDist;
    }

    return best;
  }

  // ---------------- MARCADOR ----------------
  moverMarcadorSimulado(x: number, y: number) {
    const [lat, lng] = this.convertUTMToLatLng(x, y);
    let punto = new L.LatLng(lat, lng);

    punto = this.getClosestPointOnLine(punto);

    if (this.marcadorActual) {
      this.mapa.removeLayer(this.marcadorActual);
    }

    this.marcadorActual = L.marker(punto).addTo(this.mapa);
    this.mapa.setView(punto, 17);
  }
}