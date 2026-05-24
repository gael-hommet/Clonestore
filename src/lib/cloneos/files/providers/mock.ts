// src/lib/cloneos/files/providers/mock.ts
// B34 — Mock file storage provider. No real storage. Always safe.

export type FileProviderStoreParams = {
  fileId: string;
  companyId: string;
  safeFilename: string;
  mimeType: string;
  content: string | Buffer;
  storageBucket: string;
};

export type FileProviderStoreResult = {
  ok: boolean;
  storage_path: string | null;
  public_url: string | null;
  error: string | null;
  meta: Record<string, unknown>;
};

export type FileStorageProvider = {
  id: string;
  isConfigured(): boolean;
  store(params: FileProviderStoreParams): Promise<FileProviderStoreResult>;
};

export const mockFileStorageProvider: FileStorageProvider = {
  id: "mock",

  isConfigured(): boolean {
    return true;
  },

  async store(params: FileProviderStoreParams): Promise<FileProviderStoreResult> {
    const date = new Date().toISOString().slice(0, 10);
    const storage_path = `${params.companyId}/${date}/${params.fileId}/${params.safeFilename}`;
    const public_url = null; // mock: no real URL

    return {
      ok: true,
      storage_path,
      public_url,
      error: null,
      meta: {
        mock: true,
        bucket: params.storageBucket,
        stored_at: new Date().toISOString(),
        size_bytes: Buffer.isBuffer(params.content) ? params.content.length : Buffer.byteLength(params.content, "utf8"),
      },
    };
  },
};

export function getFileStorageProvider(mode: "mock" | "disabled" | "local" | "production"): FileStorageProvider | null {
  if (mode === "disabled") return null;
  // mock, local, production all use mock in B34 (real providers wired at production time)
  return mockFileStorageProvider;
}
