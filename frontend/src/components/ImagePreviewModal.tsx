"use client";

import React, { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${titlePrefix} #${activeIndex + 1}`}
      className="fixed inset-0 z-80 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full h-[94dvh] max-w-[96vw] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Fixed Top */}
        <div className="w-full flex items-center justify-between pb-3 text-white shrink-0">
          <span className="text-sm sm:text-base font-bold">
            {titlePrefix} #{activeIndex + 1}
            {total > 1 ? ` dari ${total}` : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau foto"
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Full-Viewport Stage — tinggi tetap agar layout & posisi tombol selalu konsisten */}
        <div className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-black/55 rounded-2xl overflow-hidden border border-white/10 p-2 sm:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentSrc}
            alt={`${titlePrefix} #${activeIndex + 1}`}
            className="w-full h-full object-contain rounded-lg select-none"
          />
        </div>

        {/* Navigation Footer Fixed Bottom — letak tombol konsisten tidak bergeser */}
        {total > 1 && onChangeIndex && (
          <div className="w-full pt-3 shrink-0 flex justify-center">
            <div className="w-full max-w-md grid grid-cols-[128px_1fr_128px] sm:grid-cols-[140px_1fr_140px] items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => onChangeIndex((activeIndex - 1 + total) % total)}
                className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 active:scale-[0.98] text-white text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
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
                className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 active:scale-[0.98] text-white text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
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

