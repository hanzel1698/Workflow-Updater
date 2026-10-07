/**
 * Saves the bulk screen's PDFs where the user chooses.
 *
 * Chrome and Edge (desktop) expose the File System Access API, so the user is asked for a folder
 * once and every PDF is written straight into it — or, for the ZIP, asked where to save the one
 * file. Elsewhere (Firefox, Safari, mobile browsers) a page cannot pick a location itself; the
 * files go through the browser's ordinary download, which asks for a location only when the
 * browser is set to ("Ask where to save each file before downloading").
 *
 * The pickers need the click that asked for them, so callers open them *before* any other await.
 */

/** Remembers the last folder per purpose, so the picker reopens where the reports went last time. */
const PICKER_ID = 'rdo-kkd-reports';

export function canPickFolder() {
  return typeof window.showDirectoryPicker === 'function' && window.isSecureContext && window.self === window.top;
}

export function canPickSaveFile() {
  return typeof window.showSaveFilePicker === 'function' && window.isSecureContext && window.self === window.top;
}

/** @returns {Promise<FileSystemDirectoryHandle|null>} `null` when the user cancels */
export async function pickFolder() {
  try {
    return await window.showDirectoryPicker({ id: PICKER_ID, mode: 'readwrite', startIn: 'downloads' });
  } catch (error) {
    if (error && error.name === 'AbortError') return null;
    throw error;
  }
}

/** @returns {Promise<FileSystemFileHandle|null>} `null` when the user cancels */
export async function pickZipLocation(suggestedName) {
  try {
    return await window.showSaveFilePicker({
      id: PICKER_ID,
      startIn: 'downloads',
      suggestedName,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    });
  } catch (error) {
    if (error && error.name === 'AbortError') return null;
    throw error;
  }
}

/** Writes one file into a picked folder, replacing a same-named report from an earlier run. */
export async function writeToFolder(folder, name, blob) {
  const handle = await folder.getFileHandle(name, { create: true });
  await writeToHandle(handle, blob);
}

export async function writeToHandle(handle, blob) {
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

/**
 * Plain browser download. Several in a row are spaced out: Chrome drops downloads started in the
 * same instant, and asks once whether the site may download multiple files.
 */
export async function downloadBlobs(files) {
  for (let i = 0; i < files.length; i += 1) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 450));
    downloadBlob(files[i].name, files[i].blob);
  }
}

export function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // Long enough for a slow device to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
