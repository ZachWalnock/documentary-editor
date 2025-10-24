'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const DEFAULT_ENDPOINT = 'http://localhost:8000/upload';

const acceptedExtensions = ['.zip'];

function formatSize(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb.toFixed(2)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function HomePage() {
  const uploadEndpoint = useMemo(
    () => process.env.NEXT_PUBLIC_UPLOAD_ENDPOINT ?? DEFAULT_ENDPOINT,
    []
  );

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

  const beginUpload = useCallback(() => {
    if (!selectedFile || isUploading) {
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const formData = new FormData();
    formData.append('file', selectedFile);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadEndpoint, true);
    xhr.withCredentials = false;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const percent = Math.round((event.loaded / event.total) * 100);
      setProgress(percent);
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
      }

      setIsUploading(false);
      abortRef.current = null;

      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        setStatusMessage('Upload complete.', 'success');
        return;
      }

      let message = 'Upload failed. Please try again.';
      try {
        const response = JSON.parse(xhr.responseText);
        if (response?.detail) {
          message = response.detail;
        }
      } catch (error) {
        // ignore response parse errors
      }

      setStatusMessage(message, 'error');
      setProgress(0);
    };

    xhr.onerror = () => {
      setIsUploading(false);
      abortRef.current = null;
      setStatusMessage('Network error during upload.', 'error');
      setProgress(0);
    };

    xhr.onabort = () => {
      setIsUploading(false);
      abortRef.current = null;
      setStatusMessage('Upload cancelled.', 'info');
      setProgress(0);
    };

    setProgress(0);
    setIsUploading(true);
    setStatusMessage('Uploading…', 'pending');

    xhr.send(formData);

    controller.signal.addEventListener('abort', () => {
      xhr.abort();
    });
  }, [isUploading, selectedFile, setStatusMessage, uploadEndpoint]);

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
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <span className="progress-label">{progress ? `${progress}%` : ''}</span>
          </div>
          <p className={`status-message ${status.type || ''}`} aria-live="polite">
            {status.message}
          </p>
        </section>

        <section className="endpoint">
          <p>
            Upload target: <code>{uploadEndpoint}</code>
          </p>
        </section>
      </main>
    </div>
  );
}
