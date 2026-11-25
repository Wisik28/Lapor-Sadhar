"use client";

import React, { useState } from "react";
import { AlertCircle, AlertTriangle, Loader2, MapPin, Trash2 } from "lucide-react";
import { adminLaporanApi } from "@/lib/api";
import { formatUserFriendlyError } from "@/lib/networkError";

export interface DeleteRejectedReportTarget {
  id_laporan: number;
  deskripsi?: string | null;
  lokasi?: string | null;
}

export interface DeleteRejectedReportModalProps {
  report: DeleteRejectedReportTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (deletedId: number) => void;
}

/**
 * Modal konfirmasi penghapusan permanen laporan berstatus Ditolak oleh admin BPS/BLU.
 */
export function DeleteRejectedReportModal({
  report,
  isOpen,
  onClose,
  onDeleted,
}: DeleteRejectedReportModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [errorState, setErrorState] = useState<{
    targetId: number;
    message: string;
  } | null>(null);

  if (!isOpen || !report) {
    return null;
  }

  const error =
    errorState?.targetId === report.id_laporan ? errorState.message : "";

  const handleClose = () => {
    if (deleting) return;
    setErrorState(null);
    onClose();
  };

  const handleConfirm = async () => {
    setDeleting(true);
    setErrorState(null);

    try {
      await adminLaporanApi.deleteReport(report.id_laporan);
      setErrorState(null);
      onDeleted(report.id_laporan);
    } catch (err) {
      setErrorState({
        targetId: report.id_laporan,
        message: formatUserFriendlyError(
          err,
          "action",
          "Gagal menghapus laporan. Silakan coba lagi."
        ),
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-rejected-report-title"
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                id="delete-rejected-report-title"
                className="text-base font-extrabold text-slate-900"
              >
                Hapus Laporan Ditolak?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Laporan{" "}
                <span className="font-bold text-slate-700">
                  #{report.id_laporan}
                </span>{" "}
                akan dihapus secara permanen dari sistem beserta riwayat status
                dan lampiran fotonya. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          </div>

          {(report.deskripsi || report.lokasi) && (
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs space-y-1">
              {report.deskripsi && (
                <p className="font-bold text-slate-800 line-clamp-2">
                  {report.deskripsi}
                </p>
              )}
              {report.lokasi && (
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="truncate">{report.lokasi}</span>
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              disabled={deleting}
              onClick={handleClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleConfirm()}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Ya, Hapus Laporan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
