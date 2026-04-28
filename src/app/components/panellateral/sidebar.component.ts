import { Component, Output, EventEmitter, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { GeoService } from '../../core/geo.service';
import { PuntoGeo, Poste, TramoResultado } from '../../core/geo.interface';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, TabViewModule, TableModule, ButtonModule],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent implements OnInit {

  private geoService = inject(GeoService);

  @Input() tiempoActual: string = '0.00';
  @Output() videoSelected = new EventEmitter<File>();
  @Output() kmlSelected = new EventEmitter<File>();
  @Output() matrizGeneradaEvent = new EventEmitter<Poste[]>();
  @Output() buscarUtmEvent = new EventEmitter<{ x: string, y: string, time: number }>();

  videoFileName: string = '';
  ejeFileName: string = '';
  postesFileName: string = '';
  puntosProcesados: number = 0;
  activeIndex = 0;

  postesList: Poste[] = [];
  matrizGenerada: boolean = false;
  postesCalibradosCount: number = 0;
  inputEste: string = '';
  inputNorte: string = '';

  puntos: PuntoGeo[] = [
    { lat: -12.134585, lon: -75.220992 },
    { lat: -12.1345075, lon: -75.2209759 },
    { lat: -12.134426, lon: -75.220959 }
  ];
  resultados: TramoResultado[] = [];

  ngOnInit(): void {
    this.resultados = this.geoService.calcularTramos(this.puntos);
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
        this.puntosProcesados = 135;
        this.kmlSelected.emit(file);
      }
      if (target === 'postes') {
        this.postesFileName = file.name;
        this.matrizGenerada = false;

        const reader = new FileReader();
        reader.onload = (e) => {
          const kmlText = e.target?.result as string;
          this.postesList = this.geoService.extraerPostesDeKML(kmlText);
          console.log(`✅ ¡KML de postes leído! Se encontraron ${this.postesList.length} registros.`);
        };
        reader.readAsText(file);
      }
    }
  }

  pegarTiempo(poste: Poste) {
    poste.time = this.tiempoActual;
  }

  generarMatriz() {
    // Si quisieras omitir los de tiempo 0.00, usas el filter.
    // Como solo quieres verlos graficados, le pasamos TODOS:
    this.postesCalibradosCount = this.postesList.length;
    this.matrizGenerada = true;
    this.matrizGeneradaEvent.emit(this.postesList);
  }

  visualizar360() {
    const posteEncontrado = this.postesList.find(p => p.x === this.inputEste && p.y === this.inputNorte);
    const tiempoSalto = posteEncontrado ? parseFloat(posteEncontrado.time) : 0;
    this.buscarUtmEvent.emit({ x: this.inputEste, y: this.inputNorte, time: tiempoSalto });
  }
}
