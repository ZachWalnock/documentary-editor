'use client'

import { useCallback, useRef, useState } from 'react';
import { MAX_SIZE_BYTES, ACCEPTED_EXTENSIONS } from '../lib/constants';
import { formatSize, chunkFile } from '../lib/utils';
import {
  beginUpload as beginUploadAPI,
  getPresignedUrls,
  uploadChunks,
  completeUpload,
  abortUpload
} from '../lib/uploadService';

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
      const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

      if (!hasValidExtension) {
        setStatusMessage('Only .zip files are supported.', 'error');
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setStatusMessage(`File exceeds ${MAX_SIZE_BYTES / (1024 * 1024 * 1024)} GB limit.`, 'error');
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
      
      const fileName = selectedFile.name;
      const parts = chunkFile(selectedFile);
      
      const { uploadId, objectKey } = await beginUploadAPI(fileName, "application/octet-stream");
      console.log("Upload Started...")
      
      try {
        const signedUrls = await getPresignedUrls(objectKey, uploadId, parts.length);
        console.log("Signed URLs Retrieved. Beginning chunk upload...")
        setStatusMessage('Uploading chunks...', 'info');
        const uploadedTags = await uploadChunks(signedUrls, parts, selectedFile, (progressPercent) => {
          setProgress(progressPercent);
          setStatusMessage(`Uploading chunks... ${progressPercent}%`, 'info');
        });
        console.log("All chunks uploaded. Completing upload...")
        setStatusMessage('Finalizing upload...', 'info');
        const completedUpload = await completeUpload(objectKey, uploadId, uploadedTags);
        setStatusMessage('Upload completed successfully!', 'success');
      } catch (err) {
        const abortStatus = await abortUpload(objectKey, uploadId);
        throw new Error("Uploading chunks failed. This could be due to unstable internet.");
      }
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
              {...(progress > 0 && { style: {width: `${progress}%`}})}
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
