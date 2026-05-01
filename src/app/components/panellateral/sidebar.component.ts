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
  imports: [CommonModule, FormsModule, TabViewModule, TableModule, ButtonModule, CalendarModule],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent implements OnInit {

  private geoService = inject(GeoService);
  private apiService = inject(ApiService);

  @Input() tiempoActual: string = '0.00';
  @Input() tiempoActualN: number = 0;
  @Output() videoSelected = new EventEmitter<File>();
  @Output() kmlSelected = new EventEmitter<File>();
  @Output() matrizGeneradaEvent = new EventEmitter<MatrizGeneradaData>();
  @Output() calibracionChanged = new EventEmitter<Poste[]>();
  @Output() buscarUtmEvent = new EventEmitter<{ x: string, y: string }>();

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

  fecha: string = '';
  hora: string = '';
  csvFileName: string = '';

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
    const t = Number.isFinite(this.tiempoActualN) ? this.tiempoActualN : Number(this.tiempoActual);
    poste.time = (Number.isFinite(t) ? t : 0).toFixed(2);
    this.calibracionChanged.emit(this.postesList as any);
  }

  generarMatriz() {
    if (!this.ejeFile) {
      alert('Primero carga la ruta eje de via (.kml).');
      return;
    }

    // Contamos solo los calibrados para la validación visual
    const postesCalibrados = this.postesList.filter((p) => Number(p.time) > 0);
    if (postesCalibrados.length < 2) {
      alert('Debes calibrar al menos 2 postes con tiempo mayor a 0 para generar la matriz.');
      return;
    }

    this.postesCalibradosCount = postesCalibrados.length;

    // Pero le enviamos TODOS los postes a la API (usando mapPostesToPayload)
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
    if (x < 160000 || x > 840000 || y < 0 || y > 10000000) {
      alert('Coordenadas fuera de rango UTM 18S. Revisa Este/Norte.');
      return;
    }

    this.buscarUtmEvent.emit({ x: x.toString(), y: y.toString() });
  }

  getPostesForCalculo(): Array<{ id: number; x: string; y: string; time: string }> {
    return this.postesList.map((p) => ({ id: p.id, x: p.x, y: p.y, time: String(p.time) }));
  }

  setTramosRuta(tramos: Array<{ tramo: string; distancia_m: number; velocidad_m_s: number }>) {
    this.tramosRuta = tramos ?? [];
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
    const videoFecha = this.fecha || undefined;
    const videoHora = this.hora || undefined;

    this.apiService.exportarCsvPostes(this.mapPostesToPayload(), videoFecha ?? undefined, videoHora ?? undefined).subscribe({
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

  importarCsv(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.csvFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      try {
        this.aplicarCsvATiempos(text);
        this.calibracionChanged.emit(this.postesList as any);
        const actualizados = this.postesList.filter(p => Number(p.time) > 0).length;
        alert(`CSV importado correctamente. ${actualizados} postes con tiempo asignado.`);
      } catch (e: any) {
        alert(e?.message || 'No se pudo importar el CSV.');
      }
    };
    reader.readAsText(file);
  }

  private aplicarCsvATiempos(csvText: string) {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV vacío o inválido.');

    const header = this.parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const idxLat = header.indexOf('latitud');
    const idxLng = header.indexOf('longitud');
    const idxTiempo = header.indexOf('tiempo');
    const idxTrack = header.indexOf('track');
    if (idxTiempo < 0 || idxTrack < 0) throw new Error('CSV inválido: faltan columnas Tiempo y/o track.');

    const base = this.getBaseDateTimeForCsv(lines, idxTiempo);
    const byId = new Map<number, PosteCalibracion>();
    this.postesList.forEach(p => byId.set(Number(p.id), p));

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      if (cols.length <= Math.max(idxTiempo, idxTrack)) continue;
      const trackRaw = cols[idxTrack];
      const id = Number(trackRaw);
      if (!Number.isFinite(id)) continue;
      const iso = cols[idxTiempo];
      const dt = new Date(iso);
      if (!Number.isFinite(dt.getTime())) continue;
      const seconds = (dt.getTime() - base.getTime()) / 1000;
      const poste = byId.get(id);
      if (poste) poste.time = (Number.isFinite(seconds) ? seconds : 0).toFixed(2);
    }

    const touched = this.postesList.some(p => Number(p.time) > 0);
    if (!touched) throw new Error('No se aplicaron tiempos (track no coincide con IDs o fechas inválidas).');
  }

  private getBaseDateTimeForCsv(lines: string[], idxTiempo: number): Date {
    const fromUi = this.getVideoBaseDateTimeFromUi();
    if (fromUi) return fromUi;
    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      const iso = cols[idxTiempo];
      const dt = new Date(iso);
      if (Number.isFinite(dt.getTime())) return dt;
    }
    return new Date(0);
  }

  private getVideoBaseDateTimeFromUi(): Date | null {
    if (!this.fecha || !this.hora) return null;
    const base = new Date(`${this.fecha}T${this.hora}:00`);
    return Number.isFinite(base.getTime()) ? base : null;
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out;
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

  // 👇 MÉTODO CORREGIDO: Soluciona el zigzag y MANTIENE la línea azul 👇
  private mapPostesToPayload(): PostePayload[] {
    // 1. Obtenemos TODOS los tiempos ingresados que sean mayores a 0 y los ordenamos de menor a mayor
    const tiemposOrdenados = this.postesList
      .map(p => Number(p.time))
      .filter(t => t > 0)
      .sort((a, b) => a - b);

    let timeIndex = 0;

    // 2. Mapeamos TODA la lista original (sin eliminar los de tiempo 0)
    // Esto asegura que la API reciba toda la geometría para poder dibujar la línea azul
    return this.postesList.map((p) => {
      let t = Number(p.time) || 0;

      // Si el poste tiene un tiempo asignado, lo reemplazamos por el tiempo ordenado
      // Así evitamos el zigzag si retrocediste el video
      if (t > 0) {
        t = tiemposOrdenados[timeIndex];
        timeIndex++;
      }

      return {
        id: p.id,
        x: Number(p.x),
        y: Number(p.y),
        time: t,
        descripcion: null
      };
    });
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
