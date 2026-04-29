import { Component, ViewChild, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/panellateral/sidebar.component';
import { MapaComponent } from './components/mapa/mapa';
import { CommonModule } from '@angular/common';
import { Viewer } from '@photo-sphere-viewer/core';
import { VideoPlugin } from '@photo-sphere-viewer/video-plugin';
import { EquirectangularVideoAdapter } from '@photo-sphere-viewer/equirectangular-video-adapter';
import { MatrizGeneradaData } from './components/panellateral/sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, MapaComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  tiempoActual: string = '0.00';
  mapaPrincipal = false;

  private viewer: Viewer | null = null;
  private blobUrl: string | null = null;

  @ViewChild(MapaComponent) mapaComponent!: MapaComponent;
  @ViewChild('sphereContainer') sphereContainerRef!: ElementRef;

  ngAfterViewInit() {
    // Aquí es donde busca el video inicial. Como no lo tienes, lanza el aviso.
    // Al subir un video desde el panel, se reemplaza.
    this.initViewer('assets/test_video.mp4');
  }

  private initViewer(src: string) {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }

    this.viewer = new Viewer({
      container: this.sphereContainerRef.nativeElement,
      adapter: [EquirectangularVideoAdapter, {
        muted: true,
        autoplay: true,
      }],
      panorama: { source: src },
      plugins: [VideoPlugin],
    });

    this.viewer.addEventListener('ready', () => {
      const videoPlugin = this.viewer!.getPlugin(VideoPlugin) as any;
      const waitForVideo = setInterval(() => {
        if (videoPlugin.video) {
          clearInterval(waitForVideo);
          const videoEl: HTMLVideoElement = videoPlugin.video;
          videoEl.play();
          videoEl.addEventListener('timeupdate', () => {
            this.tiempoActual = videoEl.currentTime.toFixed(2);
            this.mapaComponent?.actualizarPunteroPorVideo(videoEl.currentTime);
          });
          videoEl.addEventListener('seeked', () => {
            this.mapaComponent?.actualizarPunteroPorVideo(videoEl.currentTime);
          });
        }
      }, 100);
    }, { once: true });
  }

  ngOnDestroy() {
    if (this.viewer) this.viewer.destroy();
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
  }

  intercambiarVistas() {
    this.mapaPrincipal = !this.mapaPrincipal;
    const interval = setInterval(() => window.dispatchEvent(new Event('resize')), 50);
    setTimeout(() => { clearInterval(interval); window.dispatchEvent(new Event('resize')); }, 600);
  }

  cargarVideoLocal(file: File) {
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    this.blobUrl = URL.createObjectURL(file);
    this.initViewer(this.blobUrl);
  }

  cargarKmlLocal(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const kmlText = e.target?.result as string;
      if (this.mapaComponent) this.mapaComponent.cargarKMLDinamico(kmlText);
    };
    reader.readAsText(file);
  }

  dibujarMatrizEnMapa(data: MatrizGeneradaData) {
    if (this.mapaComponent) {
      this.mapaComponent.dibujarPostesCalibrados(data.postes as any);
      this.mapaComponent.setRutaVideo(data.ruta as any, data.postes as any);
      this.mapaComponent.actualizarPunteroPorVideo(parseFloat(this.tiempoActual));
    }
  }

  onCalibracionChanged(postes: any[]) {
    this.mapaComponent?.dibujarPostesCalibrados(postes);
  }

  saltoVideoYMapa(data: { x: string, y: string, time: number }) {
    if (this.viewer && data.time > 0) {
      const videoPlugin = this.viewer.getPlugin(VideoPlugin) as any;
      const videoEl: HTMLVideoElement = videoPlugin.video;
      if (videoEl) {
        videoEl.currentTime = data.time;
        videoEl.play();
      }
    }
    if (this.mapaComponent) this.mapaComponent.moverMarcadorSimulado(
      parseFloat(data.x),
      parseFloat(data.y)
    );
  }
}
