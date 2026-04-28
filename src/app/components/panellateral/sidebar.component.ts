import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  @Input() tiempoActual: string = '0.00';
  @Output() videoSelected = new EventEmitter<File>();
  @Output() kmlSelected = new EventEmitter<File>();
  @Output() matrizGeneradaEvent = new EventEmitter<any[]>();
  @Output() buscarUtmEvent = new EventEmitter<{x: string, y: string, time: number}>();

  videoFileName: string = '';
  ejeFileName: string = '';
  postesFileName: string = '';
  puntosProcesados: number = 0;

  postesList: any[] = [];
  matrizGenerada: boolean = false;
  postesCalibradosCount: number = 0;
  inputEste: string = '';
  inputNorte: string = '';

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
}
