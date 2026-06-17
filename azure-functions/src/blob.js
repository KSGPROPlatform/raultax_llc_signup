const { BlobServiceClient } = require("@azure/storage-blob");
const zlib = require("node:zlib");

// Blob helper for user files. The container is chosen PER CALL (from the app
// registry); the connection comes from the STORAGE_CONNECTION app setting.

let service;
function serviceClient() {
  if (!service) {
    const conn = process.env.STORAGE_CONNECTION;
    if (!conn) throw new Error("Missing STORAGE_CONNECTION app setting");
    service = BlobServiceClient.fromConnectionString(conn);
  }
  return service;
}

function container(name) {
  // name comes from the server registry (validated in config.js); fall back to
  // the legacy default so nothing breaks if it's omitted.
  const c = name || process.env.STORAGE_CONTAINER || "democontainer";
  return serviceClient().getContainerClient(c);
}

async function uploadBuffer(containerName, blobName, buffer, contentType) {
  const blob = container(containerName).getBlockBlobClient(blobName);
  await blob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType || "application/octet-stream" },
  });
}

async function downloadBuffer(containerName, blobName) {
  return container(containerName).getBlockBlobClient(blobName).downloadToBuffer();
}

async function deleteBlob(containerName, blobName) {
  await container(containerName).getBlockBlobClient(blobName).deleteIfExists();
}

const gzip = (buf) => zlib.gzipSync(buf);
const gunzip = (buf) => zlib.gunzipSync(buf);

module.exports = { uploadBuffer, downloadBuffer, deleteBlob, gzip, gunzip };
