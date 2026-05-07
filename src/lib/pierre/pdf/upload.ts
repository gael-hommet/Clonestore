function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function uploadPierrePdfFile(input: {
  filename: string;
  content_base64: string;
  content_type?: string | null;
}) {
  const uploadUrl = getEnv("PIERRE_FILE_UPLOAD_URL");

  if (!uploadUrl) {
    return {
      uploaded: false,
      file_url: null as string | null,
      response_json: {},
    };
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getEnv("PIERRE_FILE_UPLOAD_SECRET")
        ? { "x-pierre-upload-secret": getEnv("PIERRE_FILE_UPLOAD_SECRET") }
        : {}),
    },
    body: JSON.stringify({
      filename: input.filename,
      content_base64: input.content_base64,
      content_type: input.content_type || "application/pdf",
    }),
  });

  const raw = await response.text();
  const parsed = (() => {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { raw };
    }
  })();

  if (!response.ok) {
    throw new Error(
      typeof parsed.error === "string"
        ? parsed.error
        : "Upload PDF Pierre impossible."
    );
  }

  return {
    uploaded: true,
    file_url:
      typeof parsed.file_url === "string"
        ? parsed.file_url
        : typeof parsed.url === "string"
        ? parsed.url
        : null,
    response_json: parsed,
  };
}