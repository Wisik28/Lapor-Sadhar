"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from "lucide-react";

export interface ImagePreviewModalProps {
  images: string[];
  activeIndex: number | null;
  onClose: () => void;
  onChangeIndex?: (index: number) => void;
  titlePrefix?: string;
}

/**
 * Lightbox modal reusable untuk menampilkan pratinjau foto laporan tanpa membuka tab eksternal.
 */
export default function ImagePreviewModal({
  images,
  activeIndex,
  onClose,
  onChangeIndex,
  titlePrefix = "Foto Bukti",
}: ImagePreviewModalProps) {
  const isOpen = activeIndex !== null && Boolean(images[activeIndex]);
  const total = images.length;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || activeIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft" && total > 1 && onChangeIndex) {
        onChangeIndex((activeIndex - 1 + total) % total);
      } else if (event.key === "ArrowRight" && total > 1 && onChangeIndex) {
        onChangeIndex((activeIndex + 1) % total);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, isOpen, onChangeIndex, onClose, total]);

  if (!isOpen || activeIndex === null) {
    return null;
  }

  const currentSrc = images[activeIndex];
  const canOpenInNewTab =
    !currentSrc.startsWith("data:") && !currentSrc.startsWith("blob:");
  const hasLoadError = failedSrc === currentSrc;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${titlePrefix} #${activeIndex + 1}`}
      className="fixed inset-0 z-80 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Jendela Popup Ukuran Tetap (sebesar card detail laporan) agar tidak pernah berubah-ubah */}
      <div
        className="relative w-full max-w-3xl h-[86dvh] sm:h-[88vh] bg-slate-950/95 rounded-3xl border border-white/15 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Fixed Top */}
        <div className="w-full px-4 py-3.5 sm:px-6 sm:py-4 border-b border-white/10 bg-white/[0.04] flex items-center justify-between gap-3 text-white shrink-0">
          <span className="text-sm sm:text-base font-bold truncate">
            {titlePrefix} #{activeIndex + 1}
            {total > 1 ? ` dari ${total}` : ""}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {canOpenInNewTab && (
              <a
                href={currentSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Buka di Tab Baru</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau foto"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Fixed Stage — tinggi & lebar selalu tetap, foto fit proporsional (object-contain) */}
        <div className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-black/60 p-3 sm:p-5 overflow-hidden">
          {hasLoadError ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center text-slate-300 px-4">
              <ImageOff className="w-10 h-10 text-slate-400" />
              <p className="text-sm font-semibold">Foto tidak dapat dimuat.</p>
              {canOpenInNewTab && (
                <a
                  href={currentSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-white underline underline-offset-2 hover:text-slate-200"
                >
                  Coba buka langsung di tab baru
                </a>
              )}
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={currentSrc}
              src={currentSrc}
              alt={`${titlePrefix} #${activeIndex + 1}`}
              loading="lazy"
              decoding="async"
              onError={() => setFailedSrc(currentSrc)}
              className="w-full h-full object-contain rounded-xl select-none"
            />
          )}
        </div>

        {/* Navigation Footer Fixed Bottom — letak tombol konsisten tidak bergeser */}
        {total > 1 && onChangeIndex && (
          <div className="w-full px-4 py-3 sm:px-6 border-t border-white/10 bg-white/[0.04] shrink-0 flex justify-center">
            <div className="w-full max-w-md grid grid-cols-[128px_1fr_128px] sm:grid-cols-[140px_1fr_140px] items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => onChangeIndex((activeIndex - 1 + total) % total)}
                className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Sebelumnya</span>
              </button>

              <div className="flex items-center justify-center gap-1.5 overflow-hidden px-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Lihat foto ${i + 1}`}
                    onClick={() => onChangeIndex(i)}
                    className={`h-2.5 rounded-full transition-all cursor-pointer shrink-0 ${
                      i === activeIndex ? "bg-white w-6" : "bg-white/40 hover:bg-white/60 w-2.5"
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => onChangeIndex((activeIndex + 1) % total)}
                className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

