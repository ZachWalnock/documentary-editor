// Begin a multi-part upload
export async function beginUpload(fileName, contentType = "application/octet-stream") {
  const response = await fetch('/api/multi-part-upload/begin-upload', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fileName, contentType })
  });
  return await response.json();
}

// Get presigned URLs for uploading file chunks
export async function getPresignedUrls(objectKey, uploadId, numParts) {
  const response = await fetch('/api/multi-part-upload/get-presigned-urls', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      objectKey,
      uploadId,
      numParts
    })
  });
  const body = await response.json();
  return body.presignedUrls;
}

// Upload file chunks using presigned URLs
export async function uploadChunks(presignedUrls, parts, selectedFile, onProgress) {
  let completedChunks = 0;
  const totalChunks = presignedUrls.length;
  
  const promisedChunks = presignedUrls.map(async ({ partNumber, signedUrl }, i) => {
    const { current, end } = parts[i];
    const uploadChunk = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream"
      },
      body: selectedFile.slice(current, end)
    });
    
    if (!uploadChunk.ok) {
      throw new Error(`Chunk ${partNumber}`);
    }
    
    console.log(`Chunk ${partNumber} finished uploading`);
    const etag = uploadChunk.headers.get("ETag");
    
    // Update progress after each chunk completes
    completedChunks++;
    if (onProgress) {
      const progressPercent = Math.round((completedChunks / totalChunks) * 100);
      onProgress(progressPercent);
    }
    
    return { PartNumber: partNumber, ETag: etag };
  });
  
  const uploadedChunks = await Promise.all(promisedChunks);
  return uploadedChunks;
}

// Complete a multi-part upload
export async function completeUpload(objectKey, uploadId, uploadedParts) {
  uploadedParts = uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);
  const response = await fetch("/api/multi-part-upload/complete-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      objectKey,
      uploadId,
      uploadedParts
    })
  });
  return await response.json();
}

// Abort a multi-part upload
export async function abortUpload(objectKey, uploadId) {
  const response = await fetch("/api/multi-part-upload/abort-upload", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      objectKey,
      uploadId
    })
  });
  return await response.json();
}

