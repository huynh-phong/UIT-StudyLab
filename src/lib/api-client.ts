"use client";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Gọi API nội bộ (Route Handlers). Lỗi được chuẩn hóa thành ApiClientError có thông điệp tiếng Việt. */
export async function postJson<T>(url: string, body: unknown, timeoutMs = 75_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new ApiClientError(
      timeout ? "TIMEOUT" : "NETWORK",
      timeout ? "Máy chủ phản hồi quá lâu. Vui lòng thử lại." : "Không kết nối được máy chủ. Kiểm tra mạng và thử lại.",
      0,
    );
  }
  let data: { ok?: boolean; error?: { code?: string; message?: string } } & Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ApiClientError("BAD_RESPONSE", "Máy chủ trả về dữ liệu không hợp lệ.", res.status);
  }
  if (!res.ok || data.ok === false) {
    throw new ApiClientError(data.error?.code ?? "UNKNOWN", data.error?.message ?? `Lỗi ${res.status}`, res.status);
  }
  return data as T;
}
