import { CHUNK_SIZE } from './constants';

// Format bytes to human-readable size (MB or GB)
export function formatSize(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb.toFixed(2)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
}

// Split a file into chunks for multi-part upload
export function chunkFile(file) {
  let parts = [];
  let partNumber = 1;
  for (let current = 0; current < file.size; current += CHUNK_SIZE) {
    let end = Math.min(current + CHUNK_SIZE, file.size);
    parts.push({ partNumber, current, end });
    partNumber++;
  }
  return parts;
}

