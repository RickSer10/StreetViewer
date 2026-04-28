import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/panellateral/sidebar.component';
import { MapaComponent } from './mapa/mapa';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, MapaComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  videoUrl: SafeUrl | null = null;
  tiempoActual: string = '0.00';
  mapaPrincipal = false;

  @ViewChild(MapaComponent) mapaComponent!: MapaComponent;

  constructor(private sanitizer: DomSanitizer) { }

  intercambiarVistas() {
    this.mapaPrincipal = !this.mapaPrincipal;
    const interval = setInterval(() => window.dispatchEvent(new Event('resize')), 50);
    setTimeout(() => { clearInterval(interval); window.dispatchEvent(new Event('resize')); }, 600);
  }

  cargarVideoLocal(file: File) {
    const blobUrl = URL.createObjectURL(file);
    this.videoUrl = this.sanitizer.bypassSecurityTrustUrl(blobUrl);
  }

  actualizarTiempo(event: any) {
    const video = event.target as HTMLVideoElement;
    this.tiempoActual = video.currentTime.toFixed(2);
  }

  cargarKmlLocal(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const kmlText = e.target?.result as string;
      if (this.mapaComponent) this.mapaComponent.cargarKMLDinamico(kmlText);
    };
    reader.readAsText(file);
  }

  dibujarMatrizEnMapa(postes: any[]) {
    if (this.mapaComponent) this.mapaComponent.dibujarPuntosMatriz(postes);
  }

  saltoVideoYMapa(data: { x: string, y: string, time: number }) {
    const video = document.getElementById('video360') as HTMLVideoElement;
    if (video && data.time > 0) {
      video.currentTime = data.time;
      video.play();
    }
    if (this.mapaComponent) this.mapaComponent.moverMarcadorSimulado(
      parseFloat(data.x),
      parseFloat(data.y)
    );
  }
}
