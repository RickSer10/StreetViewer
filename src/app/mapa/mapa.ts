import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-kml';
import { AfterViewInit } from '@angular/core';
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
      background-color: #f3f4f6; /* Fondo gris claro */
    }
  `]
})
export class MapaComponent implements OnInit, AfterViewInit {
  private lineaMatriz: L.Polyline | null = null;
  private mapa!: L.Map;
  private capaKmlActual: any = null;
  private capaMatriz: L.FeatureGroup = new L.FeatureGroup();
  private marcadorActual: L.Marker | null = null;

  ngOnInit(): void {
    this.iniciarMapa();
  }

  ngAfterViewInit() {
    this.asegurarTamañoMapa();
  }


  // Definiciones de proyección
  private utm = "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs";
  private wgs84 = "+proj=longlat +datum=WGS84 +no_defs";

  // Función conversión
  private convertUTMToLatLng(x: number, y: number): [number, number] {
    const [lng, lat] = proj4(this.utm, this.wgs84, [x, y]);
    return [lat, lng];
  }

  asegurarTamañoMapa() {
    if (this.mapa) {
      setTimeout(() => {
        this.mapa.invalidateSize();
      }, 100);
    }
  }

  private iniciarMapa(): void {
    this.mapa = L.map('mi-mapa', { zoomControl: true }).setView([-13.6186, -74.6547], 15);

    // --- DISEÑO ---
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.mapa);

    this.mapa.addLayer(this.capaMatriz);
  }

  cargarKMLDinamico(kmlText: string): void {
    try {
      if (this.capaKmlActual) this.mapa.removeLayer(this.capaKmlActual);
      const parser = new DOMParser();
      const kml = parser.parseFromString(kmlText, 'text/xml');
      const track = new (L as any).KML(kml);
      this.capaKmlActual = track;
      this.mapa.addLayer(track);

      const bounds = track.getBounds();
      if (bounds.isValid()) {
        this.mapa.fitBounds(bounds);
        this.colocarMarcador(bounds.getNorthWest());
      }
    } catch (err) {
      console.error("Error KML:", err);
    }
  }

  private colocarMarcador(latlng: L.LatLng): void {
    if (this.marcadorActual) this.mapa.removeLayer(this.marcadorActual);
    const icono = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/1912/1912207.png',
      iconSize: [35, 35],
      iconAnchor: [17, 35]
    });
    this.marcadorActual = L.marker(latlng, { icon: icono }).addTo(this.mapa).bindPopup("<b>Posición 360°</b>");
  }

  dibujarPuntosMatriz(postes: any[]) {
    this.capaMatriz.clearLayers();

    // 🔥 Convertir TODOS los puntos UTM a LatLng
    const coordsMatriz: L.LatLngTuple[] = postes.map(p => {
      return this.convertUTMToLatLng(parseFloat(p.x), parseFloat(p.y));
    });

    // 🔵 Línea
    this.lineaMatriz = L.polyline(coordsMatriz, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.9
    }).addTo(this.capaMatriz);

    // 🟠 Puntos
    coordsMatriz.forEach((coord, index) => {
      L.circleMarker(coord, {
        radius: 7,
        fillColor: "#f97316",
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 1
      }).addTo(this.capaMatriz)
        .bindPopup(`<b>Poste #${postes[index]?.id}</b><br>T: ${postes[index]?.time}s`);
    });

    // Ajustar vista
    this.mapa.fitBounds(this.capaMatriz.getBounds(), { padding: [50, 50] });

    this.asegurarTamañoMapa();
  }

  private getClosestPointOnLine(latlng: L.LatLng): L.LatLng {
    if (!this.lineaMatriz) return latlng;

    const latlngs = this.lineaMatriz.getLatLngs() as L.LatLng[];

    if (!latlngs || latlngs.length < 2) return latlng;

    let closestPoint = latlng;
    let minDist = Infinity;

    for (let i = 0; i < latlngs.length - 1; i++) {
      const p1 = latlngs[i];
      const p2 = latlngs[i + 1];

      const candidate = this.projectPointOnSegment(latlng, p1, p2);
      const dist = latlng.distanceTo(candidate);

      if (dist < minDist) {
        minDist = dist;
        closestPoint = candidate;
      }
    }

    return closestPoint;
  }

  private projectPointOnSegment(p: L.LatLng, p1: L.LatLng, p2: L.LatLng): L.LatLng {
    const x = p.lng, y = p.lat;
    const x1 = p1.lng, y1 = p1.lat;
    const x2 = p2.lng, y2 = p2.lat;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = dot / lenSq;

    if (param < 0) param = 0;
    else if (param > 1) param = 1;

    const xx = x1 + param * C;
    const yy = y1 + param * D;

    return new L.LatLng(yy, xx);
  }

  moverMarcadorSimulado(x: number, y: number) {
    if (isNaN(x) || isNaN(y)) return;

    const [lat, lng] = this.convertUTMToLatLng(x, y);

    if (isNaN(lat) || isNaN(lng)) return;

    let punto = new L.LatLng(lat, lng);

    punto = this.getClosestPointOnLine(punto);

    this.colocarMarcador(punto);
    this.marcadorActual?.openPopup();
    this.mapa.setView(punto, 17, { animate: true });
  }
}
