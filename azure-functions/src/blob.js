const { BlobServiceClient } = require("@azure/storage-blob");
const zlib = require("node:zlib");

// Blob helper for user files. Container + connection come from app settings.
const CONTAINER = process.env.STORAGE_CONTAINER || "democontainer";

let service;
function container() {
  if (!service) {
    const conn = process.env.STORAGE_CONNECTION;
    if (!conn) throw new Error("Missing STORAGE_CONNECTION app setting");
    service = BlobServiceClient.fromConnectionString(conn);
  }
  return service.getContainerClient(CONTAINER);
}

async function uploadBuffer(blobName, buffer, contentType) {
  const blob = container().getBlockBlobClient(blobName);
  await blob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType || "application/octet-stream" },
  });
}

async function downloadBuffer(blobName) {
  return container().getBlockBlobClient(blobName).downloadToBuffer();
}

async function deleteBlob(blobName) {
  await container().getBlockBlobClient(blobName).deleteIfExists();
}

const gzip = (buf) => zlib.gzipSync(buf);
const gunzip = (buf) => zlib.gunzipSync(buf);

module.exports = { uploadBuffer, downloadBuffer, deleteBlob, gzip, gunzip };
