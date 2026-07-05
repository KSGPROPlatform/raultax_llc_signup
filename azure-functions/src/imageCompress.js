const Jimp = require("jimp");

// Shrink an image buffer for storage: downscale so the longest edge is at most
// `maxDim`, then re-encode as JPEG at `quality`. This is REAL image compression
// (unlike gzip, which barely shrinks already-compressed JPEG/PNG) so photos drop
// from megabytes to kilobytes. Pure JS (jimp) — no native binaries to deploy.
//
// Returns { buffer, contentType, width, height, originalBytes }. If the result
// would be LARGER than the input (already-tiny images), the original is kept.
async function compressImage(buffer, opts = {}) {
  const maxDim = opts.maxDim || 2000;
  const quality = opts.quality || 80;

  const img = await Jimp.read(buffer);
  const w = img.getWidth();
  const h = img.getHeight();
  if (Math.max(w, h) > maxDim) img.scaleToFit(maxDim, maxDim);
  img.quality(quality);

  const out = await img.getBufferAsync(Jimp.MIME_JPEG);
  if (out.length >= buffer.length) {
    return {
      buffer,
      contentType: null, // unchanged — caller keeps the original content type
      width: w,
      height: h,
      originalBytes: buffer.length,
    };
  }
  return {
    buffer: out,
    contentType: "image/jpeg",
    width: img.getWidth(),
    height: img.getHeight(),
    originalBytes: buffer.length,
  };
}

// Compress an image so it fits UNDER a byte budget: downscale to `maxDim`, then
// drop JPEG quality (and, if still over, shrink further) until it's ≤ maxBytes.
// This both keeps storage small AND guarantees the file is under Document
// Intelligence's input-size limit so analysis can run. Quality starts high so
// document text stays crisp for OCR. Returns the same shape as compressImage.
async function compressImageToTarget(buffer, opts = {}) {
  const maxDim = opts.maxDim || 2000;
  const maxBytes = opts.maxBytes || 900 * 1024;

  const img = await Jimp.read(buffer);
  if (Math.max(img.getWidth(), img.getHeight()) > maxDim) img.scaleToFit(maxDim, maxDim);

  let out = null;
  for (const q of [82, 72, 62, 52, 44]) {
    img.quality(q);
    out = await img.getBufferAsync(Jimp.MIME_JPEG);
    if (out.length <= maxBytes) break;
  }
  // Still over budget at the lowest quality — shrink the dimensions once more.
  if (out && out.length > maxBytes) {
    img.scaleToFit(Math.round(img.getWidth() * 0.7), Math.round(img.getHeight() * 0.7));
    img.quality(58);
    out = await img.getBufferAsync(Jimp.MIME_JPEG);
  }
  if (!out || out.length >= buffer.length) {
    return { buffer, contentType: null, width: img.getWidth(), height: img.getHeight(), originalBytes: buffer.length };
  }
  return {
    buffer: out,
    contentType: "image/jpeg",
    width: img.getWidth(),
    height: img.getHeight(),
    originalBytes: buffer.length,
  };
}

// jimp decodes JPEG/PNG/BMP/TIFF/GIF. Anything else (e.g. HEIC) throws on read;
// callers should fall back to storing the original.
function isCompressibleImage(contentType) {
  return /^image\/(jpe?g|png|bmp|tiff?|gif)$/i.test(contentType || "");
}

module.exports = { compressImage, compressImageToTarget, isCompressibleImage };
