import { Injectable } from '@angular/core';
import { PuntoGeo, TramoResultado } from './geo.interface';

@Injectable({
  providedIn: 'root'
})
export class GeoService {

  constructor() { }

  calcularTramos(puntos: PuntoGeo[]): TramoResultado[] {
    const resultados: TramoResultado[] = [];

    for (let i = 1; i < puntos.length; i++) {
      const p1 = puntos[i - 1];
      const p2 = puntos[i];

      const distancia = this.calcularDistancia(p1, p2);
      const tiempoEstandar = 4; // Esto luego lo dara la API, por ahora lo fijo a 4 segundos por tramo
      const velocidad = distancia / tiempoEstandar;

      resultados.push({
        desde: i - 1,
        hasta: i,
        distancia: Number(distancia.toFixed(2)),
        velocidad: Number(velocidad.toFixed(2))
      });
    }

    return resultados;
  }

  private calcularDistancia(p1: PuntoGeo, p2: PuntoGeo): number {
    const R = 6371000;
    const toRad = (x: number) => x * Math.PI / 180;
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lon - p1.lon);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
