"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type PlateCoordinates = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LicensePlateMatch = {
  license_plate: string;
  confidence: number;
  coordinates: PlateCoordinates;
};

type DetectionResponse = {
  license_plates: LicensePlateMatch[];
  processed_image_path?: string;
};

const API_ENDPOINT =
  "https://bf8ba2adfa84.ngrok-free.app/api/license-plate/detect/";
const API_ORIGIN = new URL(API_ENDPOINT).origin;

export default function LicensePlateDetectionPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0.5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResponse | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const formattedConfidence = useMemo(() => {
    return `${Math.round(confidence * 100)}%`;
  }, [confidence]);

  const detectedPlates = useMemo(() => {
    return result?.license_plates ?? [];
  }, [result]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Vui lòng chọn tệp hình ảnh hợp lệ.");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setSelectedFile(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Vui lòng chọn ảnh biển số xe trước khi gửi.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("Đang gửi ảnh tới máy chủ...");
    setErrorMessage(null);
    setResult(null);
    setProcessedImageUrl(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        `${API_ENDPOINT}?confidence=${confidence.toFixed(2)}`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          message || "Máy chủ trả về lỗi. Vui lòng thử lại sau ít phút.",
        );
      }

      const data: DetectionResponse = await response.json();
      const plates = data.license_plates ?? [];
      setResult({
        license_plates: plates,
        processed_image_path: data.processed_image_path,
      });

      if (data.processed_image_path) {
        const normalizedPath = data.processed_image_path.startsWith("http")
          ? data.processed_image_path
          : `${API_ORIGIN}/${data.processed_image_path.replace(/^\//, "")}`;
        setProcessedImageUrl(normalizedPath);
      }

      setStatusMessage("Phân tích thành công.");
    } catch (error) {
      console.error(error);
      const fallbackMessage =
        error instanceof Error
          ? error.message
          : "Không thể kết nối tới máy chủ. Vui lòng thử lại.";
      setErrorMessage(fallbackMessage);
      setStatusMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setProcessedImageUrl(null);
    setStatusMessage(null);
    setErrorMessage(null);
    setConfidence(0.5);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="app-shell">
      <main className="uploader-card" role="main">
        <header className="uploader-header">
          <h1 className="uploader-title">Nhận dạng biển số xe</h1>
          <p className="uploader-subtitle">
            Tải lên hình ảnh biển số xe để hệ thống trích xuất thông tin.
          </p>
        </header>

        <form className="uploader-form" onSubmit={handleSubmit}>
          <label
            htmlFor="file-upload"
            className={`file-dropzone${
              selectedFile ? " file-dropzone--selected" : ""
            }`}
          >
            <span className="file-label-primary">
              {selectedFile
                ? selectedFile.name
                : "Chọn hoặc kéo thả hình ảnh vào đây"}
            </span>
            <span className="file-label-secondary">
              Hỗ trợ định dạng JPG, JPEG, PNG, WEBP
            </span>
          </label>
          <input
            id="file-upload"
            ref={fileInputRef}
            name="file"
            type="file"
            accept="image/*"
            className="file-input-control"
            onChange={handleFileChange}
          />

          {previewUrl ? (
            <div className="preview-panel">
              <img
                src={previewUrl}
                alt="Ảnh biển số xe đã chọn"
                className="preview-image"
              />
            </div>
          ) : null}

          <div className="control-group">
            <label htmlFor="confidence" className="control-label">
              Ngưỡng độ tin cậy: <span className="confidence-value">{formattedConfidence}</span>
            </label>
            <input
              id="confidence"
              type="range"
              min="0.10"
              max="0.95"
              step="0.01"
              value={confidence}
              onChange={(event) => setConfidence(Number(event.target.value))}
              className="confidence-slider"
            />
          </div>

          {statusMessage ? (
            <p className="status-message" role="status">
              {statusMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="error-message" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="action-row">
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang xử lý..." : "Gửi tới máy chủ"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleReset}
              disabled={isSubmitting && !selectedFile && !result}
            >
              Làm mới
            </button>
          </div>
        </form>

        {result ? (
          <section className="result-section" aria-live="polite">
            <div className="result-header">
              <h2 className="section-title">Kết quả nhận dạng</h2>
              <span className="badge">
                {detectedPlates.length} biển số
              </span>
            </div>

            {detectedPlates.length > 0 ? (
              <ul className="plate-list">
                {detectedPlates.map((plate, index) => (
                  <li className="plate-item" key={`${plate.license_plate}-${index}`}>
                    <div className="plate-info">
                      <span className="plate-text">{plate.license_plate}</span>
                      <span className="plate-confidence">
                        {(plate.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <dl className="coordinate-grid">
                      <div className="coordinate-item">
                        <dt>X</dt>
                        <dd>{plate.coordinates.x}</dd>
                      </div>
                      <div className="coordinate-item">
                        <dt>Y</dt>
                        <dd>{plate.coordinates.y}</dd>
                      </div>
                      <div className="coordinate-item">
                        <dt>Rộng</dt>
                        <dd>{plate.coordinates.width}</dd>
                      </div>
                      <div className="coordinate-item">
                        <dt>Cao</dt>
                        <dd>{plate.coordinates.height}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">Không phát hiện được biển số nào.</p>
            )}

            {processedImageUrl ? (
              <div className="processed-section">
                <h3 className="section-subtitle">Ảnh đã xử lý từ hệ thống</h3>
                <div className="processed-preview">
                  <img
                    src={processedImageUrl}
                    alt="Ảnh có vùng biển số được đánh dấu"
                    className="processed-image"
                  />
                </div>
                <a
                  className="download-link"
                  href={processedImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mở ảnh đã xử lý
                </a>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
