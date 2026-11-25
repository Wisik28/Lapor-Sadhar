<?php

namespace App\Http\Controllers;

use App\Models\AdminNotification;
use App\Services\AdminNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;

class AdminNotificationController extends Controller
{
    private const DEFAULT_LIMIT = 30;
    private const MAX_LIMIT = 100;

    public function __construct(
        private readonly AdminNotificationService $notificationService
    ) {}

    /**
     * GET /api/admin/notifications
     * Daftar notifikasi admin saat ini beserta jumlah belum dibaca dan dukungan ETag (304) untuk pembaruan real-time ringan.
     */
    public function index(Request $request): HttpResponse|JsonResponse
    {
        $admin = $request->attributes->get('admin_session')?->admin;
        if (! $admin) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Sesi admin tidak valid.',
            ], 401);
        }

        if (! $this->notificationService->hasTable()) {
            return response()->json([
                'status'       => 'success',
                'unread_count' => 0,
                'latest_id'    => 0,
                'server_time'  => now()->toIso8601String(),
                'data'         => [],
            ]);
        }

        $limit = min(
            self::MAX_LIMIT,
            max(1, (int) $request->input('limit', self::DEFAULT_LIMIT))
        );
        $unreadOnly = $request->boolean('unread_only', false);
        $sinceId = max(0, (int) $request->input('since_id', 0));

        $stats = DB::table('admin_notifications')
            ->where('admin_id', $admin->admin_id)
            ->selectRaw('COUNT(*) AS total, SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) AS unread_count, MAX(id) AS max_id, MAX(read_at) AS max_read_at, MAX(updated_at) AS max_updated_at')
            ->first();

        $total = (int) ($stats->total ?? 0);
        $unreadCount = (int) ($stats->unread_count ?? 0);
        $latestId = (int) ($stats->max_id ?? 0);

        $etag = '"' . sha1(implode('|', [
            (string) $admin->admin_id,
            (string) $total,
            (string) $unreadCount,
            (string) $latestId,
            (string) ($stats->max_read_at ?? ''),
            (string) ($stats->max_updated_at ?? ''),
            (string) $limit,
            $unreadOnly ? 'u1' : 'u0',
            (string) $sinceId,
        ])) . '"';

        if ($this->ifNoneMatchMatches($request->header('If-None-Match'), $etag)) {
            return response('', 304)
                ->header('ETag', $etag)
                ->header('Cache-Control', 'private, no-cache');
        }

        $query = AdminNotification::query()
            ->where('admin_id', $admin->admin_id)
            ->orderByDesc('id')
            ->limit($limit);

        if ($unreadOnly) {
            $query->where('is_read', false);
        }

        if ($sinceId > 0) {
            $query->where('id', '>', $sinceId);
        }

        $items = $query->get()->map(
            fn (AdminNotification $item) => $item->toApiArray()
        );

        return response()->json([
            'status'       => 'success',
            'unread_count' => $unreadCount,
            'latest_id'    => $latestId,
            'server_time'  => now()->toIso8601String(),
            'data'         => $items,
        ])
            ->header('ETag', $etag)
            ->header('Cache-Control', 'private, no-cache');
    }

    /**
     * PATCH /api/admin/notifications/{id}/read
     * Tandai satu notifikasi milik admin saat ini sebagai sudah dibaca.
     */
    public function markAsRead(Request $request, $id): JsonResponse
    {
        $admin = $request->attributes->get('admin_session')?->admin;
        if (! $admin) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Sesi admin tidak valid.',
            ], 401);
        }

        if (! $this->notificationService->hasTable()) {
            return response()->json([
                'status'       => 'success',
                'unread_count' => 0,
            ]);
        }

        $notification = AdminNotification::query()
            ->where('admin_id', $admin->admin_id)
            ->where('id', (int) $id)
            ->first();

        if (! $notification) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Notifikasi tidak ditemukan.',
            ], 404);
        }

        if (! $notification->is_read) {
            $notification->is_read = true;
            $notification->read_at = now();
            $notification->save();
        }

        $unreadCount = AdminNotification::query()
            ->where('admin_id', $admin->admin_id)
            ->where('is_read', false)
            ->count();

        return response()->json([
            'status'       => 'success',
            'message'      => 'Notifikasi ditandai sudah dibaca.',
            'unread_count' => $unreadCount,
            'data'         => $notification->toApiArray(),
        ]);
    }

    /**
     * PATCH /api/admin/notifications/read-all
     * Tandai seluruh notifikasi milik admin saat ini sebagai sudah dibaca.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $admin = $request->attributes->get('admin_session')?->admin;
        if (! $admin) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Sesi admin tidak valid.',
            ], 401);
        }

        if (! $this->notificationService->hasTable()) {
            return response()->json([
                'status'        => 'success',
                'unread_count'  => 0,
                'updated_count' => 0,
            ]);
        }

        $now = now();
        $updatedCount = AdminNotification::query()
            ->where('admin_id', $admin->admin_id)
            ->where('is_read', false)
            ->update([
                'is_read'    => true,
                'read_at'    => $now,
                'updated_at' => $now,
            ]);

        return response()->json([
            'status'        => 'success',
            'message'       => 'Seluruh notifikasi ditandai sudah dibaca.',
            'unread_count'  => 0,
            'updated_count' => $updatedCount,
        ]);
    }

    private function ifNoneMatchMatches(?string $header, string $etag): bool
    {
        if (! $header) {
            return false;
        }

        $normalizedTarget = ltrim(trim($etag), 'W/');
        foreach (explode(',', $header) as $candidate) {
            $trimmed = trim($candidate);
            if ($trimmed === '*' || ltrim($trimmed, 'W/') === $normalizedTarget) {
                return true;
            }
        }

        return false;
    }
}

