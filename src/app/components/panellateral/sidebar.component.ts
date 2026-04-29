import { Component, Output, EventEmitter, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Calendar, CalendarModule } from 'primeng/calendar';
import { HttpErrorResponse } from '@angular/common/http';
import { GeoService } from '../../core/geo.service';
import { PuntoGeo, Poste, TramoResultado } from '../../core/geo.interface';
import { ApiService, PostePayload, PuntoMatriz } from '../../core/api.service';

export interface MatrizGeneradaData {
  postes: Poste[];
  ruta: PuntoMatriz[];
}

interface PosteCalibracion extends Poste {
  lat?: number;
  lng?: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, TabViewModule, TableModule, ButtonModule,CalendarModule],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent implements OnInit {

  private geoService = inject(GeoService);
  private apiService = inject(ApiService);

  @Input() tiempoActual: string = '0.00';
  @Output() videoSelected = new EventEmitter<File>();
  @Output() kmlSelected = new EventEmitter<File>();
  @Output() matrizGeneradaEvent = new EventEmitter<MatrizGeneradaData>();
  @Output() calibracionChanged = new EventEmitter<Poste[]>();
  @Output() buscarUtmEvent = new EventEmitter<{ x: string, y: string, time: number }>();

  videoFileName: string = '';
  ejeFileName: string = '';
  postesFileName: string = '';
  puntosProcesados: number = 0;
  activeIndex = 0;
  

  postesList: PosteCalibracion[] = [];
  matrizGenerada: boolean = false;
  postesCalibradosCount: number = 0;
  inputEste: string = '';
  inputNorte: string = '';
  ejeFile: File | null = null;
  exportandoGpx = false;
  exportandoCsv = false;
  asistiendoCalibracion = false;
  
  fecha: Date | null = null;
  hora: Date | null = null;

  rutaGenerada: PuntoMatriz[] = [];
  tramosRuta: Array<{ tramo: string; distancia_m: number; velocidad_m_s: number }> = [];

  ngOnInit(): void {
    this.tramosRuta = [];
  }

  onFileChange(event: Event, target: 'video' | 'eje' | 'postes') {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      if (target === 'video') {
        this.videoFileName = file.name;
        this.videoSelected.emit(file);
      }
      if (target === 'eje') {
        this.ejeFileName = file.name;
        this.ejeFile = file;
        this.kmlSelected.emit(file);
        this.apiService.parseRuta(file).subscribe({
          next: (res) => {
            this.puntosProcesados = res.total_puntos ?? 0;
          },
          error: () => {
            this.puntosProcesados = 0;
          }
        });
      }
      if (target === 'postes') {
        if (!this.ejeFile) {
          alert('Primero carga la ruta eje de via (.kml).');
          return;
        }

        this.postesFileName = file.name;
        this.matrizGenerada = false;
        this.apiService.parsePostes(file, this.ejeFile).subscribe({
          next: (res) => {
            this.postesList = (res.postes ?? []).map((p: any) => ({
              id: p.id,
              time: (p.time ?? 0).toFixed(2),
              x: p.utm.x_este.toFixed(2),
              y: p.utm.y_norte.toFixed(2),
              lat: p.wgs84?.lat,
              lng: p.wgs84?.lng
            }));
            console.log(`Postes procesados desde API: ${this.postesList.length}`);

            // 👇 NUEVA LÍNEA: Fuerza al mapa a dibujarlos de inmediato
            this.calibracionChanged.emit(this.postesList as any);
          },
          error: (err) => {
            this.postesList = [];
            alert(this.getApiErrorMessage(err, 'No se pudieron procesar los postes en la API.'));
          }
        });
      }
    }
  }

  pegarTiempo(poste: Poste) {
    poste.time = this.tiempoActual;
    this.calibracionChanged.emit(this.postesList as any);
  }

  generarMatriz() {
    if (!this.ejeFile) {
      alert('Primero carga la ruta eje de via (.kml).');
      return;
    }
    const postesCalibrados = this.postesList.filter((p) => Number(p.time) > 0);
    if (postesCalibrados.length < 2) {
      alert('Debes calibrar al menos 2 postes con tiempo mayor a 0 para generar la matriz.');
      return;
    }

    this.postesCalibradosCount = postesCalibrados.length;
    this.apiService.generarMatriz(this.mapPostesToPayload(), this.ejeFile).subscribe({
      next: (res) => {
        this.matrizGenerada = true;
        this.rutaGenerada = res.puntos ?? [];
        this.tramosRuta = this.calcularTramosDesdeRuta(this.rutaGenerada);
        this.matrizGeneradaEvent.emit({
          postes: postesCalibrados,
          ruta: res.puntos ?? []
        });
      },
      error: (err) => {
        this.matrizGenerada = false;
        alert(this.getApiErrorMessage(err, 'No se pudo generar la matriz en la API.'));
      }
    });
  }

  asistirCalibracion() {
    if (!this.ejeFile) {
      alert('Primero carga la ruta eje de via (.kml).');
      return;
    }
    if (this.postesList.length === 0) {
      alert('Primero carga postes para calibrar.');
      return;
    }
    const currentTime = Number(this.tiempoActual);
    if (!Number.isFinite(currentTime) || currentTime <= 0) {
      alert('Reproduce el video para obtener un tiempo valido.');
      return;
    }

    this.asistiendoCalibracion = true;
    this.apiService.sugerirPosteAsistido(currentTime, this.mapPostesToPayload(), this.ejeFile).subscribe({
      next: (res) => {
        const poste = this.postesList.find((p) => p.id === res.poste_id);
        if (!poste) {
          this.asistiendoCalibracion = false;
          alert('No se encontró el poste sugerido.');
          return;
        }
        poste.time = this.tiempoActual;
        this.calibracionChanged.emit(this.postesList as any);
        this.asistiendoCalibracion = false;
      },
      error: (err) => {
        this.asistiendoCalibracion = false;
        alert(this.getApiErrorMessage(err, 'No se pudo obtener sugerencia asistida.'));
      }
    });
  }

  visualizar360() {
    const x = parseFloat(this.inputEste);
    const y = parseFloat(this.inputNorte);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      alert('Ingresa coordenadas UTM numericas validas.');
      return;
    }
    // Rango aproximado UTM zona 18S (EPSG:32718)
    if (x < 160000 || x > 840000 || y < 0 || y > 10000000) {
      alert('Coordenadas fuera de rango UTM 18S. Revisa Este/Norte.');
      return;
    }

    const posteEncontrado = this.postesList.find(p => p.x === this.inputEste && p.y === this.inputNorte);
    const tiempoSalto = posteEncontrado ? parseFloat(posteEncontrado.time) : 0;
    this.buscarUtmEvent.emit({ x: x.toString(), y: y.toString(), time: tiempoSalto });
  }

  exportarGpx() {
    if (!this.ejeFile) {
      alert('Primero carga la ruta eje de via (.kml).');
      return;
    }
    this.exportandoGpx = true;
    this.apiService.exportarGpx(this.mapPostesToPayload(), this.ejeFile).subscribe({
      next: (blob) => {
        this.descargarBlob('ruta.gpx', blob);
        this.exportandoGpx = false;
      },
      error: (err) => {
        this.exportandoGpx = false;
        alert(this.getApiErrorMessage(err, 'No se pudo exportar GPX desde la API.'));
      }
    });
  }

  exportarCsvPostes() {
    if (this.postesList.length === 0) {
      alert('No hay postes para exportar.');
      return;
    }

    this.exportandoCsv = true;
    this.apiService.exportarCsvPostes(this.mapPostesToPayload()).subscribe({
      next: (blob) => {
        this.descargarBlob('postes_calibrados.csv', blob);
        this.exportandoCsv = false;
      },
      error: (err) => {
        this.exportandoCsv = false;
        alert(this.getApiErrorMessage(err, 'No se pudo exportar CSV de postes desde la API.'));
      }
    });
  }

  private calcularTramosDesdeRuta(ruta: PuntoMatriz[]) {
    if (!ruta || ruta.length < 2) return [];
    const puntos = [...ruta].sort((a, b) => a.tiempo_video_s - b.tiempo_video_s);
    const out: Array<{ tramo: string; distancia_m: number; velocidad_m_s: number }> = [];
    for (let i = 1; i < puntos.length; i++) {
      const p0 = puntos[i - 1];
      const p1 = puntos[i];
      const d = this.haversineM(p0.lat, p0.lng, p1.lat, p1.lng);
      const dt = p1.tiempo_video_s - p0.tiempo_video_s;
      const v = dt > 0 ? d / dt : 0;
      out.push({
        tramo: `${i - 1} → ${i}`,
        distancia_m: Number(d.toFixed(2)),
        velocidad_m_s: Number(v.toFixed(2)),
      });
    }
    return out;
  }

  private haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000;
    const toRad = (x: number) => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private mapPostesToPayload(): PostePayload[] {
    return this.postesList.map((p) => ({
      id: p.id,
      x: Number(p.x),
      y: Number(p.y),
      time: Number(p.time) || 0,
      descripcion: null
    }));
  }

  private descargarBlob(nombre: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  private getApiErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const detail = err.error?.detail;
      if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
      }
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0];
        if (typeof first?.msg === 'string' && first.msg.trim().length > 0) {
          return first.msg;
        }
      }
    }
    return fallback;
  }
}
