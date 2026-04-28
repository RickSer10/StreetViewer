import { Injectable } from '@angular/core';
import { PuntoGeo, TramoResultado, Poste } from './geo.interface';
import * as proj4 from 'proj4';

@Injectable({
  providedIn: 'root'
})
export class GeoService {

  constructor() { }

  // ---------------- LECTURA DE KML POR FUERZA BRUTA (REGEX) ----------------
  extraerPostesDeKML(kmlText: string): Poste[] {
    const postes: Poste[] = [];
    const wgs84 = "+proj=longlat +datum=WGS84 +no_defs";
    const proj4Fn = (proj4 as any).default || proj4;
    let idCounter = 1;

    try {
      // 🔥 LA FUERZA BRUTA: Buscará cualquier texto atrapado entre etiquetas "coordinates"
      // sin importar si dice <coordinates>, <kml:coordinates>, <gml:coordinates>, etc.
      const regex = /<(?:[a-zA-Z0-9-]+:)?coordinates>([\s\S]*?)<\/(?:[a-zA-Z0-9-]+:)?coordinates>/gi;
      let match;

      while ((match = regex.exec(kmlText)) !== null) {
        const coordsStr = match[1].trim();

        // Los KML a veces agrupan muchos puntos en una sola línea separados por espacios
        const pares = coordsStr.split(/\s+/);

        for (const par of pares) {
          const parts = par.split(',');
          // Necesitamos que haya al menos latitud y longitud
          if (parts.length >= 2) {
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);

            if (!isNaN(lat) && !isNaN(lon)) {
              // Calculamos la zona UTM
              const zone = Math.floor((lon + 180) / 6) + 1;
              const south = lat < 0;
              const utm = `+proj=utm +zone=${zone} ${south ? '+south' : ''} +datum=WGS84 +units=m +no_defs`;

              try {
                const [x, y] = proj4Fn(wgs84, utm, [lon, lat]);
                postes.push({
                  id: idCounter++,
                  time: '0.00',
                  x: x.toFixed(2),
                  y: y.toFixed(2)
                });
              } catch (err) {
                console.error("Error proyectando UTM:", err);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error en lectura Regex:", err);
    }

    return postes;
  }

  // ---------------- CÁLCULO DE TRAMOS ----------------
  calcularTramos(puntos: PuntoGeo[]): TramoResultado[] {
    const resultados: TramoResultado[] = [];
    for (let i = 1; i < puntos.length; i++) {
      const p1 = puntos[i - 1];
      const p2 = puntos[i];
      const distancia = this.calcularDistancia(p1, p2);
      const tiempoEstandar = 4;
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
