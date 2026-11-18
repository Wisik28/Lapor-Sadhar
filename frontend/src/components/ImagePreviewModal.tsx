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
      className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between pb-3 text-white">
          <span className="text-sm font-bold">
            {titlePrefix} #{activeIndex + 1}
            {total > 1 ? ` dari ${total}` : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau foto"
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full max-h-[75vh] flex items-center justify-center bg-black/50 rounded-2xl overflow-hidden border border-white/10 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentSrc}
            alt={`${titlePrefix} #${activeIndex + 1}`}
            className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-2xl"
          />
        </div>

        {total > 1 && onChangeIndex && (
          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => onChangeIndex((activeIndex - 1 + total) % total)}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>
            <div className="flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Lihat foto ${i + 1}`}
                  onClick={() => onChangeIndex(i)}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    i === activeIndex ? "bg-white w-6" : "bg-white/40 w-2.5"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => onChangeIndex((activeIndex + 1) % total)}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

