import { app, dialog, nativeImage, shell, type BrowserWindow } from 'electron';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import type { AttachmentFile, AttachmentMimeType } from '../../shared/ipc-types';

// Phone photos are often 5–15 MB; they shrink to a few hundred KB once resized.
const MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_STORED_BYTES = 10 * 1024 * 1024;
// Long edge of a stored photo: still readable for a bill or receipt, small
// enough that a year of expenses does not bloat every backup.
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 80;

const EXTENSION: Record<AttachmentMimeType, string> = {
  'image/jpeg': '.jpg',
  'application/pdf': '.pdf',
};

const looksLike: Record<AttachmentMimeType, (data: Buffer) => boolean> = {
  'image/jpeg': (d) => d.length > 3 && d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff,
  'application/pdf': (d) => d.subarray(0, 5).toString('latin1') === '%PDF-',
};

/** A display name with no path, control characters, or the original extension. */
function cleanName(name: string): string {
  const base = basename(name, extname(name))
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ')
    .trim()
    .slice(0, 100);
  return base || 'attachment';
}

function readPicked(file: string): AttachmentFile {
  const name = cleanName(file);
  const size = statSync(file).size;

  if (extname(file).toLowerCase() === '.pdf') {
    if (size > MAX_STORED_BYTES) throw new Error(`"${basename(file)}" is larger than 10 MB.`);
    const data = readFileSync(file);
    if (!looksLike['application/pdf'](data)) throw new Error(`"${basename(file)}" is not a PDF.`);
    return { fileName: name + '.pdf', mimeType: 'application/pdf', dataBase64: data.toString('base64') };
  }

  if (size > MAX_IMAGE_INPUT_BYTES) throw new Error(`"${basename(file)}" is larger than 25 MB.`);
  // nativeImage decodes PNG/JPEG only; anything else comes back empty.
  const image = nativeImage.createFromBuffer(readFileSync(file));
  if (image.isEmpty()) throw new Error(`"${basename(file)}" is not a PNG or JPEG image.`);

  const { width, height } = image.getSize();
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const resized =
    scale < 1
      ? image.resize({
          width: Math.round(width * scale),
          height: Math.round(height * scale),
          quality: 'best',
        })
      : image;
  const data = resized.toJPEG(JPEG_QUALITY);
  return { fileName: name + '.jpg', mimeType: 'image/jpeg', dataBase64: data.toString('base64') };
}

export const attachmentsService = {
  async pick(parent: BrowserWindow | null): Promise<AttachmentFile[]> {
    const options: Electron.OpenDialogOptions = {
      title: 'Attach bill or receipt',
      filters: [{ name: 'Images and PDFs', extensions: ['png', 'jpg', 'jpeg', 'pdf'] }],
      properties: ['openFile', 'multiSelections'],
    };
    const picked = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (picked.canceled) return [];
    return picked.filePaths.map(readPicked);
  },

  /**
   * Checks a file the renderer sends back for saving. It came from pick(), but
   * anything crossing IPC is re-checked before it reaches the database.
   */
  decode(file: AttachmentFile): { fileName: string; mimeType: AttachmentMimeType; data: Buffer } {
    if (!Object.hasOwn(EXTENSION, file.mimeType)) {
      throw new Error(`Unsupported attachment type: ${file.mimeType}`);
    }
    const data = Buffer.from(file.dataBase64, 'base64');
    if (data.length === 0) throw new Error(`"${file.fileName}" is empty.`);
    if (data.length > MAX_STORED_BYTES) throw new Error(`"${file.fileName}" is larger than 10 MB.`);
    if (!looksLike[file.mimeType](data)) {
      throw new Error(`"${file.fileName}" does not match its file type.`);
    }
    return {
      fileName: cleanName(file.fileName) + EXTENSION[file.mimeType],
      mimeType: file.mimeType,
      data,
    };
  },

  /**
   * Writes the file to a temp folder and opens it in the default viewer. The
   * extension always comes from the checked type, never the stored name, so a
   * file can only ever open as an image or a PDF.
   */
  async open(id: number, file: { fileName: string; mimeType: AttachmentMimeType; data: Buffer }) {
    const dir = join(app.getPath('temp'), 'mughal-pos-attachments');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${id}-${cleanName(file.fileName)}${EXTENSION[file.mimeType]}`);
    writeFileSync(path, file.data);
    const error = await shell.openPath(path);
    if (error) throw new Error(`Could not open the attachment: ${error}`);
  },
};
