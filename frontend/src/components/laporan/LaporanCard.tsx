/**
 * Komponen Reusable untuk Laporan Card
 * Digunakan di semua fitur untuk menampilkan laporan
 */

'use client';

import React from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { LaporanItem } from '@/lib/api';

// Status Config - reusable di semua tempat
export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  Terkirim: { label: 'Terkirim', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  Diverifikasi: { label: 'Diverifikasi', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
  Diproses: { label: 'Diproses', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  Selesai: { label: 'Selesai', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  Ditolak: { label: 'Ditolak', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
};

function formatTanggal(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['Terkirim'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

interface LaporanCardProps {
  lap: LaporanItem;
  expandedId: number | null;
  setExpandedId: (id: number | null) => void;
}

export function LaporanCard({ lap, expandedId, setExpandedId }: LaporanCardProps) {
  const isExpanded = expandedId === lap.id_laporan;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
      <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                lap.kategori_laporan === 'Fasilitas' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              }`}
            >
              {lap.kategori_laporan}
            </span>
            <StatusBadge status={lap.status_terkini} />
          </div>
          <p className="text-sm font-semibold text-slate-800 truncate">{lap.lokasi}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {formatTanggal(lap.tanggal_kejadian)} · ID #{lap.id_laporan}
          </p>
        </div>
        <button
          onClick={() => setExpandedId(isExpanded ? null : lap.id_laporan)}
          className="min-h-[36px] w-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all shrink-0"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 pt-3 space-y-3">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Deskripsi</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100">{lap.deskripsi}</p>
          </div>

          {lap.riwayat_status && lap.riwayat_status.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Riwayat Status</p>
              <div className="space-y-1.5">
                {lap.riwayat_status.map((s) => {
                  const cfg = STATUS_CONFIG[s.status_laporan] ?? STATUS_CONFIG['Terkirim'];
                  return (
                    <div key={s.id_status} className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className={`text-xs font-semibold ${cfg.color}`}>{s.status_laporan}</span>
                      <span className="text-xs text-slate-400">{formatTanggal(s.tanggal_merubah)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Dibuat: {formatTanggal(lap.tanggal_buat)}</span>
            {lap.tanggal_rubah && (
              <>
                <span>·</span>
                <span>Diperbarui: {formatTanggal(lap.tanggal_rubah)}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
