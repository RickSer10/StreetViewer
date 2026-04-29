import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PostePayload {
  id: number;
  x: number;
  y: number;
  time: number;
  descripcion?: string | null;
}

export interface ParseRutaResponse {
  total_puntos: number;
}

export interface ParsePostesResponse {
  postes: Array<{
    id: number;
    wgs84?: {
      lat: number;
      lng: number;
    };
    utm: {
      x_este: number;
      y_norte: number;
    };
    time: number;
  }>;
}

export interface PuntoMatriz {
  lat: number;
  lng: number;
  tiempo_video_s: number;
}

export interface AsistidoResponse {
  poste_id: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = 'https://visor-66mb.onrender.com';

  constructor(private http: HttpClient) {}

  private buildMatrizFormData(postes: PostePayload[], fileEje: File): FormData {
    const formData = new FormData();
    formData.append('file_eje', fileEje);
    formData.append('body', JSON.stringify({ postes }));
    return formData;
  }

  parseRuta(fileEje: File): Observable<ParseRutaResponse> {
    const formData = new FormData();
    formData.append('file', fileEje);
    return this.http.post<ParseRutaResponse>(`${this.baseUrl}/kml/parse-ruta`, formData);
  }

  parsePostes(filePostes: File, fileEje: File): Observable<ParsePostesResponse> {
    const formData = new FormData();
    formData.append('file_postes', filePostes);
    formData.append('file_eje', fileEje);
    return this.http.post<ParsePostesResponse>(`${this.baseUrl}/kml/parse-postes`, formData);
  }

  generarMatriz(postes: PostePayload[], fileEje: File): Observable<{ puntos: PuntoMatriz[] }> {
    return this.http.post<{ puntos: PuntoMatriz[] }>(
      `${this.baseUrl}/matriz/generar`,
      this.buildMatrizFormData(postes, fileEje)
    );
  }

  exportarJson(postes: PostePayload[], fileEje: File): Observable<unknown> {
    return this.http.post(
      `${this.baseUrl}/exportar/json`,
      this.buildMatrizFormData(postes, fileEje)
    );
  }

  exportarGpx(postes: PostePayload[], fileEje: File): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/exportar/gpx`, this.buildMatrizFormData(postes, fileEje), {
      responseType: 'blob'
    });
  }

  exportarCsvPostes(postes: PostePayload[]): Observable<Blob> {
    const formData = new FormData();
    formData.append('body', JSON.stringify({ postes }));
    return this.http.post(`${this.baseUrl}/exportar/csv-postes`, formData, {
      responseType: 'blob'
    });
  }

  sugerirPosteAsistido(currentTime: number, postes: PostePayload[], fileEje: File): Observable<AsistidoResponse> {
    const formData = new FormData();
    formData.append('file_eje', fileEje);
    formData.append('body', JSON.stringify({ current_time: currentTime, postes }));
    return this.http.post<AsistidoResponse>(`${this.baseUrl}/asistido/sugerir-poste`, formData);
  }
}
