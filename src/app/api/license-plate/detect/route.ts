import { NextRequest, NextResponse } from "next/server";

const BACKEND_ENDPOINT =
  "https://bf8ba2adfa84.ngrok-free.app/api/license-plate/detect/";
const BACKEND_ORIGIN = new URL(BACKEND_ENDPOINT).origin;

function normalizeConfidence(rawValue: unknown): string {
  if (typeof rawValue !== "string") {
    return "0.50";
  }

  const numericValue = Number.parseFloat(rawValue);
  if (!Number.isFinite(numericValue)) {
    return "0.50";
  }

  const clampedValue = Math.min(Math.max(numericValue, 0), 1);
  return clampedValue.toFixed(2);
}

export async function POST(request: NextRequest) {
  try {
    const incomingForm = await request.formData();
    const fileField = incomingForm.get("file");

    if (!fileField || typeof fileField === "string") {
      return NextResponse.json(
        { message: "Tệp hình ảnh không hợp lệ hoặc bị thiếu." },
        { status: 400 },
      );
    }

    const proxyForm = new FormData();
    const fileName = typeof (fileField as File).name === "string"
      ? (fileField as File).name
      : "uploaded-image";
    proxyForm.append("file", fileField, fileName);

    const confidenceParam = request.nextUrl.searchParams.get("confidence");
    const bodyConfidence = incomingForm.get("confidence");
    const normalizedConfidence = normalizeConfidence(
      confidenceParam ?? bodyConfidence,
    );

    const upstreamUrl = new URL(BACKEND_ENDPOINT);
    upstreamUrl.searchParams.set("confidence", normalizedConfidence);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      body: proxyForm,
    });

    const cacheHeaders: HeadersInit = {
      "Cache-Control": "no-store",
    };

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();

      try {
        const parsedError = JSON.parse(errorText);
        return NextResponse.json(parsedError, {
          status: upstreamResponse.status,
          headers: cacheHeaders,
        });
      } catch (parseError) {
        return NextResponse.json(
          {
            message:
              errorText ||
              "Máy chủ xử lý biển số trả về lỗi. Vui lòng thử lại sau.",
          },
          {
            status: upstreamResponse.status,
            headers: cacheHeaders,
          },
        );
      }
    }

    const data = await upstreamResponse.json();
    const processedPath =
      data && typeof data.processed_image_path === "string"
        ? data.processed_image_path
        : null;
    const processedUrl = processedPath
      ? processedPath.startsWith("http")
        ? processedPath
        : `${BACKEND_ORIGIN}/${processedPath.replace(/^\//, "")}`
      : null;

    return NextResponse.json(
      {
        ...data,
        processed_image_url: processedUrl,
      },
      { headers: cacheHeaders },
    );
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      {
        message:
          "Không thể kết nối tới máy chủ xử lý biển số. Vui lòng thử lại sau.",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
