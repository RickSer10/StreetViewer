import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  @Input() collapsed = false;
  videoFile: File | null = null;
ejeFile: File | null = null;

onFileChange(event: Event, target: 'video' | 'eje') {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (target === 'video') this.videoFile = file;
  if (target === 'eje') this.ejeFile = file;
}
}
