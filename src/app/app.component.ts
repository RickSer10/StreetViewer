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
  imports: [SidebarComponent, MapaComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  tiempoActual: string = '0.00';
  tiempoActualN: number = 0;
  mapaPrincipal = false;
  videoListo = false; // <-- Añadimos la bandera

  private viewer: Viewer | null = null;
  private blobUrl: string | null = null;

  @ViewChild(MapaComponent) mapaComponent!: MapaComponent;
  @ViewChild(SidebarComponent) sidebarComponent!: SidebarComponent;
  @ViewChild('sphereContainer') sphereContainerRef!: ElementRef;

  ngAfterViewInit() {
// Ya no inicializamos un video por defecto para que muestre la pantalla "Sin video"
    // this.initViewer('assets/test_video.mp4');
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

          const syncDuration = () => {
            const d = Number(videoEl.duration);
            if (Number.isFinite(d) && d > 0) this.mapaComponent?.setVideoDuration(d);
          };
          videoEl.addEventListener('loadedmetadata', syncDuration);
          setTimeout(syncDuration, 250);

          // 👇 NUEVO: Forzamos la actualización del puntero apenas el video existe
          setTimeout(() => {
            this.mapaComponent?.actualizarPunteroPorVideo(videoEl.currentTime || 0);
          }, 150);

          // 👇 Prevenimos errores si el navegador bloquea el autoplay silenciosamente
          videoEl.play().catch(() => console.log('Autoplay en espera de interacción'));

          videoEl.play();
          videoEl.addEventListener('timeupdate', () => {
            this.tiempoActualN = videoEl.currentTime;
            this.tiempoActual = videoEl.currentTime.toFixed(2);
            this.mapaComponent?.actualizarPunteroPorVideo(videoEl.currentTime);
          });
          videoEl.addEventListener('seeked', () => {
            this.tiempoActualN = videoEl.currentTime;
            this.tiempoActual = videoEl.currentTime.toFixed(2);
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
    this.videoListo = true; // <-- Indicamos que el video ya se cargó

    // Le damos un pequeño respiro a Angular para que quite la clase "hidden"
    // del contenedor antes de montar el Viewer de 360, sino dará error de dimensiones.
    setTimeout(() => {
      this.initViewer(this.blobUrl!);
    }, 50);
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
    this.mapaComponent.centrarEnRuta(); // ← NUEVA llamada
  }
    if (this.sidebarComponent && this.mapaComponent) {
      const tramos = this.mapaComponent.calcularTramosPorPostes(data.postes as any);
      this.sidebarComponent.setTramosRuta(tramos);
    }
  }

  onCalibracionChanged(postes: any[]) {
    this.mapaComponent?.dibujarPostesCalibrados(postes);
  }

  saltoVideoYMapa(data: { x: string, y: string }) {
    const x = parseFloat(data.x);
    const y = parseFloat(data.y);
    const postes = this.sidebarComponent?.getPostesForCalculo?.() ?? [];
    const calc = this.mapaComponent?.calcularTiempoParaUtm(x, y, postes as any);

    if (!calc) {
      alert('No se pudo calcular el tiempo. Genera la matriz primero con al menos 2 postes calibrados.');
      return;
    }

    const time = calc.time;

    if (this.mapaComponent) {
      this.mapaComponent.moverMarcadorSimulado(x, y);
    }

    if (this.viewer) {
      const videoPlugin = this.viewer.getPlugin(VideoPlugin) as any;
      const videoEl: HTMLVideoElement | undefined = videoPlugin?.video;
      if (videoEl) {
        videoEl.currentTime = time;
        videoEl.play().catch(() => {});
      } else {
        alert('El video no está listo aún. Espera a que cargue completamente.');
      }
    } else {
      alert('Carga un video 360° para poder visualizar en esta coordenada.');
    }
  }
}
