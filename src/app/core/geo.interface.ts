export interface PuntoGeo {
  lat: number;
  lon: number;
}

export interface Poste {
  id: number;
  time: string;
  x: string;
  y: string;
}

export interface TramoResultado {
  desde: number;
  hasta: number;
  distancia: number;
  velocidad: number;
}
