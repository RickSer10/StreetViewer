import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [],
  templateUrl: './mapa.html', // <-- Apuntando a tu archivo corto
  styleUrl: './mapa.css'      // <-- Apuntando a tu archivo corto
})
export class Mapa implements OnInit { // <-- Clase renombrada a 'Mapa'

  ngOnInit(): void {
    this.iniciarMapa();
  }

  private iniciarMapa(): void {
    const mapa = L.map('mi-mapa').setView([-12.0410, -76.9500], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapa);

    const rutaExacta: L.LatLngTuple[] = [
      [-12.0380, -76.9600],
      [-12.0395, -76.9550],
      [-12.0410, -76.9500],
      [-12.0430, -76.9450],
      [-12.0450, -76.9400]
    ];

    L.polyline(rutaExacta, { color: 'blue', dashArray: '5, 10' }).addTo(mapa);

    const iconoPersonita = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/1912/1912207.png',
      iconSize: [40, 40],
      iconAnchor: [20, 40]
    });

    const marcadorMovil = L.marker(rutaExacta[0], { icon: iconoPersonita }).addTo(mapa);

    let pasoActual = 0;
    const intervalo = setInterval(() => {
      pasoActual++;
      if (pasoActual >= rutaExacta.length) {
        clearInterval(intervalo);
        marcadorMovil.bindPopup("<b>¡Llegué a mi destino!</b>").openPopup();
        return;
      }
      marcadorMovil.setLatLng(rutaExacta[pasoActual]);
    }, 1500);
  }
}
