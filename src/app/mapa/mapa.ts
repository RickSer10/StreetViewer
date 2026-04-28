import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
// Importamos el plugin de KML.
// Nota: Si TypeScript marca error aquí, es normal, por eso usamos el 'declare var L' abajo.
import 'leaflet-kml';
import { AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [],
  templateUrl: './mapa.html',
  styleUrl: './mapa.css'
})
export class MapaComponent implements OnInit, AfterViewInit {

  esMini = false;
  private mapa!: L.Map;

  ngAfterViewInit() {
    setTimeout(() => {
      this.mapa.invalidateSize();
    }, 100);
  }

  toggleMapa() {
    this.esMini = !this.esMini;

    // Ejecutamos esto varias veces para que el mapa se "reacomode"
    // mientras la caja se va encogiendo o agrandando.
    const refreshInterval = setInterval(() => {
      this.mapa.invalidateSize();
    }, 50);

    setTimeout(() => {
      clearInterval(refreshInterval);
      this.mapa.invalidateSize();
    }, 600); // Se detiene justo después de que termina la animación de 500ms
  }

  ngOnInit(): void {
    this.iniciarMapa();
    this.cargarRutaKML(); // <-- Llamamos a la carga del archivo real
  }

  private iniciarMapa(): void {
    // Inicializamos el mapa en una posición neutral (luego el KML moverá la cámara)
    this.mapa = L.map('mi-mapa').setView([-13.6186, -74.6547], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.mapa);
  }

  private cargarRutaKML(): void {
    fetch('assets/ruta_real.kml')
      .then(res => res.text())
      .then(kmltext => {
        const parser = new DOMParser();
        const kml = parser.parseFromString(kmltext, 'text/xml');

        // Usamos (L as any) para que TS nos deje usar el plugin KML
        const track = new (L as any).KML(kml);
        this.mapa.addLayer(track);

        const bounds = track.getBounds();
        if (bounds.isValid()) {
          this.mapa.fitBounds(bounds);
          this.añadirPersonita(bounds.getNorthWest());
        }
      })
      .catch(err => console.error("Error en el mapa:", err));
  }

  private añadirPersonita(posicionInicial: L.LatLng): void {
    const iconoPersonita = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/1912/1912207.png',
      iconSize: [40, 40],
      iconAnchor: [20, 40]
    });

    L.marker(posicionInicial, { icon: iconoPersonita })
      .addTo(this.mapa)
      .bindPopup("<b>Inicio de la Ruta 1138</b>")
      .openPopup();
  }
}
