'use client'

import { sign } from 'crypto';
import { useCallback, useMemo, useRef, useState } from 'react';

const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const CHUNK_SIZE = 10 * 1024 * 1024
const acceptedExtensions = ['.zip'];

function formatSize(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb.toFixed(2)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
}

function chunk_file(file) {
  let parts = [];
  let partNumber = 1;
  for (let current = 0; current < file.size; current+=CHUNK_SIZE) {
    let end = Math.min(current+CHUNK_SIZE, file.size);
    parts.push({partNumber, current, end});
    partNumber++;
  }
  return parts;
}

async function getPresignedUrls(objectKey, uploadId, numParts) {
  const signedUrls = await fetch('/api/multi-part-upload/get-presigned-urls', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      objectKey, uploadId, numParts
    })
  })
  const body = await signedUrls.json()
  return body.presignedUrls;
}

async function uploadChunks(presignedUrls, parts, selectedFile) {
  const promisedChunks = presignedUrls.map(async ({ partNumber, signedUrl }, i) => {
    const { current, end } = parts[i];
    const uploadChunk = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream"
      },
      body: selectedFile.slice(current, end)
    })
    if (!uploadChunk.ok) {
      throw new Error(`Chunk ${partNumber}`)
    }
    console.log(`Chunk ${partNumber} finished uploading`);
    const etag = uploadChunk.headers.get("ETag");
    return { PartNumber: partNumber, ETag: etag };
  });
  const uploadedChunks = await Promise.all(promisedChunks);
  return uploadedChunks;
}

async function completeUpload(objectKey, uploadId, uploadedParts) {
  uploadedParts = uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);
  const completeReq = await fetch("/api/multi-part-upload/complete-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      objectKey, uploadId, uploadedParts
    })
  });
  return await completeReq.json();
}

async function abortUpload(objectKey, uploadId) {
  const abortReq = await fetch("/api/multi-part-upload/abort-upload", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      objectKey, uploadId
    })
  })
  return await abortReq.json()
}

export default function HomePage() {

  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState({ message: '', type: '' });

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setProgress(0);
    setStatus({ message: '', type: '' });
    setIsUploading(false);
    abortRef.current?.abort();
    abortRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const setStatusMessage = useCallback((message, type) => {
    setStatus({ message, type });
  }, []);

  const handleFile = useCallback(
    (file) => {
      if (!file) {
        return;
      }

      const lowerName = file.name.toLowerCase();
      const hasValidExtension = acceptedExtensions.some((ext) => lowerName.endsWith(ext));

      if (!hasValidExtension) {
        setStatusMessage('Only .zip files are supported.', 'error');
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setStatusMessage('File exceeds 2 GB limit.', 'error');
        return;
      }

      setSelectedFile(file);
      setStatusMessage('', '');
    },
    [setStatusMessage]
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsDragging(false);

      const file = event.dataTransfer?.files?.item(0);
      handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setIsDragging(false);
  }, []);

  const onKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  }, []);

  const beginUpload = useCallback(async () => {
    if (!selectedFile || isUploading) {
      return;
    }
    
    try {
      setIsUploading(true);
      setStatusMessage('Getting upload URL...', 'info');
      
      // Extract file extension from the file name
      const fileName = selectedFile.name
      const file_extension = fileName.substring(fileName.lastIndexOf('.'));

      const parts = chunk_file(selectedFile);
      const beginUpload = await fetch('api/multi-part-upload/begin-upload', {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fileName, contentType: "application/octet-stream"})
      });
      try {
        const { uploadId, objectKey } = await beginUpload.json();
        const signedUrls = await getPresignedUrls(objectKey, uploadId, parts.length);
        const uploadedTags = await uploadChunks(signedUrls, parts, selectedFile);
        const completedUpload = await completeUpload(objectKey, uploadId, uploadedTags);
      } catch (err) {
        console.log(`Error while uploading: ${err}`)
        const abortStatus = await abortUpload(objectKey, uploadId);
      }

      

      // const chunks = chunk_file(selectedFile);
      // const presigned_urls = await get_presigned_urls(fileKey, uploadId, chunks.length, "application/octet-stream");
      // const uploadPromises = presigned_urls.map(async ({ presigned_url, part_number }, i) => {
      //   let { current, end } = parts[i];
      //   const uploadFile = await fetch(presigned_url, {
      //     method: "PUT",
      //     headers: {
      //       "Content-Type": "application/octet-stream"
      //     },
      //     body: selectedFile.slice(current, end)
      //   });

      //   if (!uploadFile.ok) {
      //     throw new Error(`Failed to upload part ${part_number}`);
      //   }
      //   const etag = uploadFile.headers.get("ETag");
      //   return {part_number, etag};
      // })

      // const uploadResults = await Promise.all(uploadPromises);

      
      setStatusMessage('Upload URL received!', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      setStatusMessage(error.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, selectedFile, setStatusMessage]);

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-track" aria-hidden />
        <h1>Auto Editor Upload Console</h1>
        <p>Stage your project archive in the cloud and start editing faster.</p>
      </header>

      <main className="panel">
        <section
          className={`dropzone ${isDragging ? 'dragover' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload ZIP file"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={onKeyDown}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden-input"
            onChange={(event) => handleFile(event.target.files?.item(0))}
          />
          <div className="dropzone-content">
            <span className="cta">Drop your ZIP here</span>
            <span className="hint">or click to browse files</span>
            {selectedFile ? (
              <div className="file-meta">
                <span className="filename">{selectedFile.name}</span>
                <span className="filesize">{formatSize(selectedFile.size)}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="actions">
          <button
            type="button"
            className="primary"
            disabled={!selectedFile || isUploading}
            onClick={beginUpload}
          >
            {isUploading ? 'Uploading…' : 'Upload to S3'}
          </button>
          <button type="button" onClick={resetState}>
            Reset
          </button>
          {isUploading ? (
            <button type="button" className="link" onClick={cancelUpload}>
              Cancel upload
            </button>
          ) : null}
        </section>

        <section className="status">
          <div className="progress" role="status" aria-live="polite">
            <div 
              className="progress-bar" 
              {...(progress > 0 && { style: {width: `${progress}`}})}
              suppressHydrationWarning 
            />
            <span className="progress-label">{progress ? `${progress}%` : ''}</span>
          </div>
          <p className={`status-message ${status.type || ''}`} aria-live="polite">
            {status.message}
          </p>
        </section>
      </main>
    </div>
  );
}
