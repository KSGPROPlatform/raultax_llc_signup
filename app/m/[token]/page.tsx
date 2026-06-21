import { verifyUploadToken } from "@/lib/uploadToken";
import { MobileUpload } from "@/components/documents/MobileUpload";

// Public, token-gated mobile upload page reached by scanning a QR. The token
// encodes the user + the exact document slot (and job), so no login is needed
// and the upload lands in the right place. Not under the proxy auth guard.
export default async function MobileUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const auth = await verifyUploadToken(token);

  if (!auth) {
    return (
      <main className="grid min-h-dvh place-items-center bg-zinc-50 p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">This link is invalid or expired</h1>
          <p className="mt-2 text-sm text-zinc-500">
            On your computer, tap <span className="font-medium">Use phone</span> next to the document to get a fresh link.
          </p>
        </div>
      </main>
    );
  }

  return <MobileUpload token={token} label={auth.label || "your document"} />;
}
