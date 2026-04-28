import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

interface Resultado {
  desde: number;
  hasta: number;
  distancia: number;
  velocidad: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, TabViewModule, TableModule, ButtonModule],
  templateUrl: './sidebar.component.html'
})

export class SidebarComponent implements OnInit{
  ngOnInit(): void {
    this.procesarDatos();
  }
  @Input() tiempoActual: string = '0.00';
  @Output() videoSelected = new EventEmitter<File>();
  @Output() kmlSelected = new EventEmitter<File>();
  @Output() matrizGeneradaEvent = new EventEmitter<any[]>();
  @Output() buscarUtmEvent = new EventEmitter<{ x: string, y: string, time: number }>();

  videoFileName: string = '';
  ejeFileName: string = '';
  postesFileName: string = '';
  puntosProcesados: number = 0;
  activeIndex = 0;
  postesList: any[] = [];
  matrizGenerada: boolean = false;
  postesCalibradosCount: number = 0;
  inputEste: string = '';
  inputNorte: string = '';

  puntos = [
    { lat: -12.134585, lon: -75.220992 },
    { lat: -12.1345075, lon: -75.2209759 },
    { lat: -12.134426, lon: -75.220959 }
  ];
  resultados: Resultado[] = [];

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
        this.puntosProcesados = 135;
        this.kmlSelected.emit(file);
      }
      if (target === 'postes') {
        this.postesFileName = file.name;
        this.matrizGenerada = false;
        this.postesList = [
          { id: 7, time: '0.00', x: '587395.42', y: '8504073.80' },
          { id: 8, time: '0.00', x: '587451.37', y: '8503956.16' },
          { id: 9, time: '0.00', x: '587458.87', y: '8503937.30' },
          { id: 10, time: '0.00', x: '587502.11', y: '8503910.45' }
        ];
      }
    }
  }

  pegarTiempo(poste: any) {
    poste.time = this.tiempoActual;
  }

  generarMatriz() {
    const postesValidos = this.postesList.filter(p => p.time !== '0.00');
    this.postesCalibradosCount = postesValidos.length;
    this.matrizGenerada = true;
    this.matrizGeneradaEvent.emit(this.postesList);
  }

  visualizar360() {
    const posteEncontrado = this.postesList.find(p => p.x === this.inputEste && p.y === this.inputNorte);
    const tiempoSalto = posteEncontrado ? parseFloat(posteEncontrado.time) : 0;
    this.buscarUtmEvent.emit({ x: this.inputEste, y: this.inputNorte, time: tiempoSalto });
  }

  calcularDistancia(p1: any, p2: any): number {
    const R = 6371000; // radio tierra en metros

    const toRad = (x: number) => x * Math.PI / 180;

    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lon - p1.lon);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // metros
  }

  procesarDatos() {
    this.resultados = [];

    for (let i = 1; i < this.puntos.length; i++) {
      const p1 = this.puntos[i - 1];
      const p2 = this.puntos[i];

      const distancia = this.calcularDistancia(p1, p2); // metros
      const tiempo = 4; // segundos (promedio)

      const velocidad = distancia / tiempo; // m/s

      this.resultados.push({
        desde: i - 1,
        hasta: i,
        distancia: Number(distancia.toFixed(2)),
        velocidad: Number(velocidad.toFixed(2))
      });
    }
  }


}
