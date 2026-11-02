import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface AttachmentViewerData {
  fileName: string;
  /** Data URL of the image. */
  src: string;
}

@Component({
  selector: 'app-attachment-viewer-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title class="truncate">{{ data.fileName }}</h2>
    <mat-dialog-content>
      <img [src]="data.src" [alt]="data.fileName" class="block max-w-full h-auto mx-auto" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close cdkFocusInitial>Close</button>
    </mat-dialog-actions>
  `,
})
export class AttachmentViewerDialog {
  readonly data = inject<AttachmentViewerData>(MAT_DIALOG_DATA);
}
