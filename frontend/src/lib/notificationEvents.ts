// Cross-tab real-time notification sync helper (BroadcastChannel + localStorage fallback)

const CHANNEL_NAME = "lapor_sadhar_admin_notifications";
const STORAGE_KEY = "lapor_sadhar_admin_notif_ping";

export type NotificationSyncReason =
  | "laporan_baru"
  | "revisi_laporan"
  | "read_updated";

export function emitAdminNotificationSync(reason: NotificationSyncReason): void {
  if (typeof window === "undefined") return;

  const payload = { reason, ts: Date.now() };

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // Abaikan jika browser membatasi BroadcastChannel
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Abaikan jika storage tidak tersedia
  }
}

export function subscribeAdminNotificationSync(
  onSync: (reason?: NotificationSyncReason) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<{ reason?: NotificationSyncReason }>) => {
        onSync(event.data?.reason);
      };
    }
  } catch {
    channel = null;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as { reason?: NotificationSyncReason };
      onSync(parsed?.reason);
    } catch {
      onSync();
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    if (channel) {
      try {
        channel.close();
      } catch {
        // ignore
      }
    }
  };
}

