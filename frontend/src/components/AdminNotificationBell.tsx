"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  FileEdit,
  FilePlus2,
  Loader2,
  MapPin,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import {
  adminNotificationApi,
  type AdminNotificationItem,
} from "@/lib/api";
import { subscribeAdminNotificationSync } from "@/lib/notificationEvents";
import { formatUserFriendlyError, isAbortError } from "@/lib/networkError";

const POLL_INTERVAL_MS = 4000;
const TIME_TICK_INTERVAL_MS = 30000;
const TOAST_DURATION_MS = 6000;

export interface AdminNotificationBellProps {
  isReadOnly?: boolean;
}

function formatRelativeTime(isoDate?: string | null, nowMs: number = Date.now()): string {
  if (!isoDate) return "-";
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return isoDate;

  const diffSeconds = Math.max(0, Math.floor((nowMs - parsed) / 1000));
  if (diffSeconds < 30) return "Baru saja";
  if (diffSeconds < 60) return `${diffSeconds} dtk lalu`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return new Date(parsed).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatExactDateTime(isoDate?: string | null): string {
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;

  return parsed.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTanggalKejadian(rawDate?: string | null): string {
  if (!rawDate) return "";
  const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate;

  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminNotificationBell({
  isReadOnly = false,
}: AdminNotificationBellProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const etagRef = useRef<string | null>(null);
  const latestIdRef = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const ringTimerRef = useRef<number | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<"semua" | "belum_dibaca">("semua");
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");
  const [isRinging, setIsRinging] = useState(false);
  const [liveToast, setLiveToast] = useState<AdminNotificationItem | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const showLiveToast = useCallback((item: AdminNotificationItem) => {
    setLiveToast(item);
    setIsRinging(true);

    if (ringTimerRef.current) window.clearTimeout(ringTimerRef.current);
    ringTimerRef.current = window.setTimeout(() => {
      setIsRinging(false);
    }, 1500);

    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setLiveToast(null);
    }, TOAST_DURATION_MS);
  }, []);

  const fetchNotifications = useCallback(
    async (options?: { force?: boolean; silent?: boolean }) => {
      if (typeof window === "undefined" || !localStorage.getItem("admin_token")) {
        setLoading(false);
        return;
      }

      if (inFlightRef.current && !options?.force) {
        return;
      }

      if (options?.force) {
        abortControllerRef.current?.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      inFlightRef.current = true;

      if (!options?.silent) {
        setRefreshing(true);
      }

      try {
        const result = await adminNotificationApi.getList({
          limit: 40,
          etag: options?.force ? null : etagRef.current,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!result.not_modified) {
          etagRef.current = result.etag ?? null;
          setNotifications(result.data);
          setUnreadCount(result.unread_count);
          setError("");

          // Tampilkan live toast & animasi lonceng hanya untuk notifikasi baru setelah muatan awal
          if (
            initializedRef.current &&
            result.latest_id > latestIdRef.current
          ) {
            const newestUnread = result.data.find(
              (item) => item.id > latestIdRef.current && !item.is_read
            );
            if (newestUnread) {
              showLiveToast(newestUnread);
            }
          }

          latestIdRef.current = Math.max(latestIdRef.current, result.latest_id);
          initializedRef.current = true;
        }
      } catch (err: unknown) {
        if (isAbortError(err) || controller.signal.aborted) return;
        if (!options?.silent) {
          setError(
            formatUserFriendlyError(
              err,
              "load",
              "Gagal memuat daftar notifikasi."
            )
          );
        }
      } finally {
        if (abortControllerRef.current === controller) {
          inFlightRef.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [showLiveToast]
  );

  // Polling real-time ringan berbasis ETag (304 Not Modified) + event fokus, online, & lintas-tab
  useEffect(() => {
    let active = true;

    const initialTimer = window.setTimeout(() => {
      if (active) {
        void fetchNotifications({ force: true, silent: true });
      }
    }, 0);

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchNotifications({ silent: true });
      }
    }, POLL_INTERVAL_MS);

    const tickInterval = window.setInterval(() => {
      setNowTick(Date.now());
    }, TIME_TICK_INTERVAL_MS);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void fetchNotifications({ silent: true });
      }
    };

    const handleOnline = () => {
      void fetchNotifications({ force: true, silent: true });
    };

    const unsubscribeSync = subscribeAdminNotificationSync(() => {
      void fetchNotifications({ force: true, silent: true });
    });

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(pollInterval);
      window.clearInterval(tickInterval);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (ringTimerRef.current) window.clearTimeout(ringTimerRef.current);
      abortControllerRef.current?.abort();
      unsubscribeSync();
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, [fetchNotifications]);

  // Tutup dropdown saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const displayedNotifications = useMemo(() => {
    if (filterTab === "belum_dibaca") {
      return notifications.filter((item) => !item.is_read);
    }
    return notifications;
  }, [notifications, filterTab]);

  const resolveDetailRoute = useCallback(
    (idLaporan: number) => {
      return isReadOnly
        ? `/admin/prioritas?id=${idLaporan}`
        : `/admin/ubah-status?id=${idLaporan}`;
    },
    [isReadOnly]
  );

  const handleMarkAsRead = useCallback(
    async (item: AdminNotificationItem) => {
      if (item.is_read) return;

      setMarkingId(item.id);
      const readAtNow = new Date().toISOString();

      // Pembaruan optimistis agar respons UI langsung terasa instan
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, is_read: true, read_at: readAtNow } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      etagRef.current = null;

      try {
        const res = await adminNotificationApi.markAsRead(item.id);
        setUnreadCount(res.unread_count);
      } catch (err) {
        setError(
          formatUserFriendlyError(
            err,
            "action",
            "Gagal menandai notifikasi sebagai dibaca."
          )
        );
        void fetchNotifications({ force: true, silent: true });
      } finally {
        setMarkingId(null);
      }
    },
    [fetchNotifications]
  );

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;

    setMarkingAll(true);
    const readAtNow = new Date().toISOString();

    setNotifications((prev) =>
      prev.map((n) =>
        n.is_read ? n : { ...n, is_read: true, read_at: readAtNow }
      )
    );
    setUnreadCount(0);
    etagRef.current = null;

    try {
      await adminNotificationApi.markAllAsRead();
    } catch (err) {
      setError(
        formatUserFriendlyError(
          err,
          "action",
          "Gagal menandai seluruh notifikasi sebagai dibaca."
        )
      );
      void fetchNotifications({ force: true, silent: true });
    } finally {
      setMarkingAll(false);
    }
  };

  const handleOpenNotification = (item: AdminNotificationItem) => {
    if (!item.is_read) {
      void handleMarkAsRead(item);
    }
    setIsOpen(false);
    setLiveToast(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("lapor-sadhar:open-report", {
          detail: { idLaporan: item.id_laporan },
        })
      );
    }
    router.push(resolveDetailRoute(item.id_laporan));
  };

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => {
            const nextOpen = !isOpen;
            setIsOpen(nextOpen);
            if (nextOpen) {
              setLiveToast(null);
              void fetchNotifications({ silent: false });
            }
          }}
          aria-label={
            unreadCount > 0
              ? `Notifikasi (${unreadCount} belum dibaca)`
              : "Notifikasi"
          }
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className="relative flex flex-col items-center justify-center group focus:outline-none cursor-pointer p-1"
        >
          <div
            className={`relative w-8 h-8 rounded-full border flex items-center justify-center transition-colors shadow-2xs ${
              isOpen
                ? "border-[#7A0C0C] bg-[#7A0C0C]/10 text-[#7A0C0C]"
                : unreadCount > 0
                  ? "border-red-300 bg-red-50/70 text-[#7A0C0C] group-hover:border-[#7A0C0C]"
                  : "border-slate-300 bg-white text-slate-700 group-hover:border-slate-400 group-hover:text-slate-900"
            }`}
          >
            <Bell
              className={`w-4 h-4 transition-transform ${
                isRinging ? "animate-bounce" : "group-hover:scale-105"
              }`}
            />

            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} notifikasi belum dibaca`}
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-extrabold leading-none flex items-center justify-center ring-2 ring-white shadow-xs"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 leading-none transition-colors ${
              isOpen
                ? "text-[#7A0C0C]"
                : "text-slate-700 group-hover:text-slate-900"
            }`}
          >
            Notifikasi
          </span>
        </button>

        {/* Panel Dropdown Daftar Notifikasi */}
        {isOpen && (
          <div
            role="dialog"
            aria-label="Daftar Notifikasi Admin"
            className="fixed left-3 right-3 top-[68px] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[410px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Header Panel */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Notifikasi
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                    {unreadCount} baru
                  </span>
                )}
                <span
                  title="Pembaruan otomatis aktif"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[10px] font-semibold text-emerald-700"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live</span>
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void fetchNotifications({ force: true })}
                  disabled={refreshing}
                  title="Segarkan notifikasi"
                  aria-label="Segarkan notifikasi"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#7A0C0C] hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Tutup panel notifikasi"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tab & Aksi Tandai Semua Dibaca */}
            <div className="px-4 py-2 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterTab("semua")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    filterTab === "semua"
                      ? "bg-[#7A0C0C] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                  }`}
                >
                  Semua ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("belum_dibaca")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    filterTab === "belum_dibaca"
                      ? "bg-[#7A0C0C] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                  }`}
                >
                  Belum Dibaca ({unreadCount})
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllAsRead()}
                  disabled={markingAll}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7A0C0C] hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {markingAll ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Tandai semua dibaca</span>
                </button>
              )}
            </div>

            {/* Error Banner */}
            {error && (
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center justify-between gap-2 text-xs text-red-700">
                <span className="font-medium">{error}</span>
                <button
                  type="button"
                  onClick={() => void fetchNotifications({ force: true })}
                  className="text-[11px] font-bold underline shrink-0 cursor-pointer"
                >
                  Coba lagi
                </button>
              </div>
            )}

            {/* Daftar Notifikasi */}
            <div className="max-h-[min(65vh,420px)] overflow-y-auto divide-y divide-slate-100">
              {loading && notifications.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-[#7A0C0C]" />
                  <p className="text-xs font-medium">Memuat notifikasi...</p>
                </div>
              ) : displayedNotifications.length === 0 ? (
                <div className="py-10 px-6 flex flex-col items-center justify-center text-center gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    {filterTab === "belum_dibaca"
                      ? "Semua notifikasi sudah dibaca"
                      : "Belum ada notifikasi"}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Notifikasi akan muncul otomatis saat pelapor mengirim laporan baru atau merevisi pengajuan.
                  </p>
                </div>
              ) : (
                displayedNotifications.map((item) => {
                  const isRevision = item.jenis_aktivitas === "revisi_laporan";
                  const lokasiDisplay = [item.lokasi_kampus, item.lokasi]
                    .filter(Boolean)
                    .join(" • ");
                  const incidentDate = formatTanggalKejadian(item.tanggal_kejadian);

                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenNotification(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpenNotification(item);
                        }
                      }}
                      className={`p-3.5 transition-colors cursor-pointer outline-none focus-visible:bg-slate-100 ${
                        item.is_read
                          ? "bg-white hover:bg-slate-50/90"
                          : "bg-red-50/40 hover:bg-red-50/75"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Ikon Jenis Aktivitas */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                            isRevision
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {isRevision ? (
                            <FileEdit className="w-4 h-4" />
                          ) : (
                            <FilePlus2 className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          {/* Baris 1: Jenis Aktivitas + Kode Laporan + Dot Unread */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  isRevision
                                    ? "bg-amber-100/80 text-amber-800 border-amber-200"
                                    : "bg-blue-100/80 text-blue-800 border-blue-200"
                                }`}
                              >
                                {item.label_aktivitas ||
                                  (isRevision ? "Revisi Pengajuan" : "Laporan Baru")}
                              </span>
                              <span className="font-mono text-[11px] font-bold text-[#7A0C0C]">
                                #{item.kode_laporan}
                              </span>
                              {item.kategori_laporan && (
                                <span className="text-[10px] font-semibold text-slate-500">
                                  • {item.kategori_laporan}
                                </span>
                              )}
                            </div>

                            {!item.is_read && (
                              <span
                                title="Belum dibaca"
                                className="w-2 h-2 rounded-full bg-[#7A0C0C] shrink-0"
                              />
                            )}
                          </div>

                          {/* Baris 2: Informasi Laporan */}
                          <p
                            className={`text-xs leading-snug line-clamp-2 ${
                              item.is_read
                                ? "text-slate-600 font-normal"
                                : "text-slate-900 font-semibold"
                            }`}
                          >
                            {item.pesan}
                          </p>

                          {/* Baris 3: Pelapor & Lokasi */}
                          <div className="space-y-0.5 text-[11px] text-slate-500">
                            <p className="flex items-center gap-1.5 truncate">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-semibold text-slate-700 truncate">
                                {item.nama_pelapor}
                              </span>
                              {item.nim_pelapor && (
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  ({item.nim_pelapor})
                                </span>
                              )}
                            </p>
                            {lokasiDisplay && (
                              <p className="flex items-center gap-1.5 truncate">
                                <MapPin className="w-3 h-3 text-[#7A0C0C]/70 shrink-0" />
                                <span className="truncate">{lokasiDisplay}</span>
                              </p>
                            )}
                          </div>

                          {/* Baris 4: Waktu Kejadian & Aksi */}
                          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span
                                title={formatExactDateTime(item.created_at)}
                                className="inline-flex items-center gap-1 font-medium text-slate-500"
                              >
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>
                                  {formatRelativeTime(item.created_at, nowTick)}
                                </span>
                              </span>
                              {item.created_at && (
                                <span>
                                  • {formatExactDateTime(item.created_at)}
                                </span>
                              )}
                              {incidentDate && (
                                <span>• Kejadian: {incidentDate}</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 ml-auto">
                              {!item.is_read && (
                                <button
                                  type="button"
                                  disabled={markingId === item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleMarkAsRead(item);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-[#7A0C0C]/40 hover:text-[#7A0C0C] text-[10px] font-semibold text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {markingId === item.id ? (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  ) : (
                                    <Check className="w-2.5 h-2.5" />
                                  )}
                                  <span>Tandai dibaca</span>
                                </button>
                              )}
                              <span className="inline-flex items-center gap-0.5 font-semibold text-[#7A0C0C]">
                                <span>Detail</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Real-Time Toast Notifikasi Masuk */}
      {liveToast && !isOpen && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-60 w-[min(23rem,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl border border-red-200/90 p-3.5 text-slate-800 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                liveToast.jenis_aktivitas === "revisi_laporan"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-red-50 text-[#7A0C0C] border-red-200"
              }`}
            >
              {liveToast.jenis_aktivitas === "revisi_laporan" ? (
                <FileEdit className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleOpenNotification(liveToast)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleOpenNotification(liveToast);
                }
              }}
              className="min-w-0 flex-1 cursor-pointer space-y-1"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-[#7A0C0C]">
                  {liveToast.label_aktivitas}
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-500">
                  #{liveToast.kode_laporan}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-900 truncate">
                {liveToast.nama_pelapor}
              </p>
              <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">
                {liveToast.pesan}
              </p>
              <p className="text-[10px] font-semibold text-[#7A0C0C] inline-flex items-center gap-1 pt-0.5">
                <span>Klik untuk membuka detail laporan</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              aria-label="Tutup notifikasi"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
