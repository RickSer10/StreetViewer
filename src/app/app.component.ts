import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/panellateral/sidebar.component';
import { MapaComponent } from './mapa/mapa';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, MapaComponent, CommonModule], // <-- Una sola línea con todo
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
[x: string]: any;
  title = 'StreetviewGM';
  collapsed = false;
  esMini = false;
}
