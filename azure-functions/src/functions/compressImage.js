const { app } = require("@azure/functions");
const { compressImage } = require("../imageCompress");

// POST /api/compressImage?maxDim=&quality=   body: raw image bytes
// -> compressed image bytes (JPEG). Stateless + app-agnostic, so ANY application
// can reuse it: send an image, get a smaller one back. Response headers report
// the sizes (X-Original-Bytes / X-Compressed-Bytes) and dimensions.
app.http("compressImage", {
  methods: ["POST"],
  authLevel: "function",
  route: "compressImage",
  handler: async (request, context) => {
    try {
      const buf = Buffer.from(await request.arrayBuffer());
      if (!buf.length) return { status: 400, jsonBody: { error: "Empty body" } };

      const maxDim = Number(request.query.get("maxDim")) || 2000;
      const quality = Number(request.query.get("quality")) || 80;

      let out;
      try {
        out = await compressImage(buf, { maxDim, quality });
      } catch (e) {
        return { status: 415, jsonBody: { error: "Unreadable or unsupported image format" } };
      }

      const contentType =
        out.contentType ||
        request.headers.get("content-type") ||
        "application/octet-stream";
      return {
        status: 200,
        body: out.buffer,
        headers: {
          "Content-Type": contentType,
          "X-Original-Bytes": String(out.originalBytes),
          "X-Compressed-Bytes": String(out.buffer.length),
          "X-Width": String(out.width),
          "X-Height": String(out.height),
        },
      };
    } catch (err) {
      context.error("compressImage failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
