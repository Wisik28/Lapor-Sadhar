<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\AdminSession;
use App\Models\EmailVerificationCode;
use App\Models\UserMahasiswa;
use App\Models\UserPegawai;
use App\Models\UserSession;
use App\Services\EmailCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Validator as ValidationValidator;
use Throwable;

class EmailSecurityController extends Controller
{
    public function __construct(private readonly EmailCodeService $emailCodes) {}

    public function requestUserPasswordReset(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|max:255',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator);
        }

        $account = $this->findUserByEmail($this->normalizeEmail($request->email));

        if ($account && $account['user']->email) {
            try {
                $this->emailCodes->send(
                    $account['type'],
                    $account['id'],
                    'password_reset',
                    $account['user']->email,
                );
            } catch (Throwable $exception) {
                report($exception);

                return response()->json([
                    'status' => 'error',
                    'message' => 'Email tidak dapat dikirim saat ini. Periksa konfigurasi email lalu coba lagi.',
                ], 503);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Jika alamat email terdaftar, kode reset akan dikirim ke email tersebut.',
        ]);
    }

    public function resetUserPassword(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|max:255',
            'code' => 'required|digits:6',
            'password' => 'required|string|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator);
        }

        $account = $this->findUserByEmail($this->normalizeEmail($request->email));
        if (! $account) {
            return $this->invalidCodeResponse();
        }

        $updated = DB::transaction(function () use ($account, $request): bool {
            $verification = $this->lockVerification(
                $account['type'],
                $account['id'],
                'password_reset',
                $account['user']->email,
                $request->code,
            );

            if (! $verification) {
                return false;
            }

            $account['user']->update(['password' => Hash::make($request->password)]);
            $verification->update(['consumed_at' => now()]);
            UserSession::query()
                ->where('account_type', $account['type'])
                ->where('account_id', $account['id'])
                ->delete();

            return true;
        });

        if (! $updated) {
            return $this->invalidCodeResponse();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Kata sandi berhasil direset. Silakan masuk dengan kata sandi baru.',
        ]);
    }

    public function requestAdminPasswordReset(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:255',
            'jabatan' => ['required', 'string', 'in:'.implode(',', array_keys(Admin::POSITIONS))],
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator);
        }

        $admin = Admin::query()
            ->where('username', trim($request->username))
            ->where('jabatan', $request->jabatan)
            ->first();

        if ($admin?->email) {
            try {
                $this->emailCodes->send('admin', (string) $admin->admin_id, 'password_reset', $admin->email);
            } catch (Throwable $exception) {
                report($exception);

                return response()->json([
                    'status' => 'error',
                    'message' => 'Email tidak dapat dikirim saat ini. Periksa konfigurasi email lalu coba lagi.',
                ], 503);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Jika akun admin terdaftar dan memiliki email, kode reset akan dikirim ke email tersebut.',
        ]);
    }

    public function resetAdminPassword(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:255',
            'jabatan' => ['required', 'string', 'in:'.implode(',', array_keys(Admin::POSITIONS))],
            'code' => 'required|digits:6',
            'password' => 'required|string|min:12|confirmed',
        ], [
            'password.min' => 'Kata sandi admin minimal 12 karakter.',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator);
        }

        $admin = Admin::query()
            ->where('username', trim($request->username))
            ->where('jabatan', $request->jabatan)
            ->first();

        if (! $admin?->email) {
            return $this->invalidCodeResponse();
        }

        $updated = DB::transaction(function () use ($admin, $request): bool {
            $verification = $this->lockVerification(
                'admin',
                (string) $admin->admin_id,
                'password_reset',
                $admin->email,
                $request->code,
            );

            if (! $verification) {
                return false;
            }

            $admin->update(['password' => Hash::make($request->password)]);
            $verification->update(['consumed_at' => now()]);
            AdminSession::where('admin_id', $admin->admin_id)->delete();

            return true;
        });

        if (! $updated) {
            return $this->invalidCodeResponse();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Kata sandi admin berhasil direset. Silakan masuk kembali.',
        ]);
    }

    public function requestUserEmailChange(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'new_email' => 'required|email|max:255',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator);
        }

        $user = $request->attributes->get('authenticated_user');
        $newEmail = $this->normalizeEmail($request->new_email);

        if (strcasecmp((string) $user->email, $newEmail) === 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email baru sama dengan email yang sedang digunakan.',
            ], 422);
        }

        if ($this->emailIsUsed($newEmail, $user)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email tersebut sudah digunakan oleh akun lain.',
            ], 422);
        }

        try {
            $session = $request->attributes->get('user_session');
            $currentEmail = $user->email;
            $purpose = $currentEmail ? 'email_change' : 'email_setup';
            $this->emailCodes->send(
                $session->account_type,
                $session->account_id,
                $purpose,
                $currentEmail ?: $newEmail,
                $newEmail,
            );
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'status' => 'error',
                'message' => 'Email verifikasi tidak dapat dikirim saat ini. Coba lagi nanti.',
            ], 503);
        }

        return response()->json([
            'status' => 'success',
            'message' => $currentEmail
                ? 'Kode verifikasi telah dikirim ke email lama Anda.'
                : 'Akun ini belum memiliki email. Kode verifikasi awal telah dikirim ke email baru.',
        ]);
    }

    public function confirmUserEmailChange(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|digits:6',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator);
        }

        $session = $request->attributes->get('user_session');
        $user = $request->attributes->get('authenticated_user');
        $purpose = $user->email ? 'email_change' : 'email_setup';

        $updated = DB::transaction(function () use ($session, $user, $request, $purpose): bool {
            $verification = $this->lockVerification(
                $session->account_type,
                $session->account_id,
                $purpose,
                $user->email,
                $request->code,
            );

            if (! $verification || ! $verification->target_email) {
                return false;
            }

            if ($this->emailIsUsed($verification->target_email, $user)) {
                $verification->update(['consumed_at' => now()]);

                return false;
            }

            $user->update(['email' => $verification->target_email]);
            $verification->update(['consumed_at' => now()]);

            return true;
        });

        if (! $updated) {
            return $this->invalidCodeResponse();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Email akun berhasil diperbarui.',
            'email' => $user->fresh()->email,
        ]);
    }

    /**
     * @return array{type: 'mahasiswa'|'karyawan', id: string, user: UserMahasiswa|UserPegawai}|null
     */
    private function findUserByEmail(string $email): ?array
    {
        $student = UserMahasiswa::where('email', $email)->first();
        $employee = UserPegawai::where('email', $email)->first();

        if ($student && $employee) {
            return null;
        }

        if ($student) {
            return ['type' => 'mahasiswa', 'id' => $student->nim, 'user' => $student];
        }

        if ($employee) {
            return ['type' => 'karyawan', 'id' => $employee->nomor_identitas, 'user' => $employee];
        }

        return null;
    }

    private function emailIsUsed(string $email, UserMahasiswa|UserPegawai $except): bool
    {
        $studentQuery = UserMahasiswa::where('email', $email);
        $employeeQuery = UserPegawai::where('email', $email);

        if ($except instanceof UserMahasiswa) {
            $studentQuery->where('nim', '!=', $except->nim);
        } else {
            $employeeQuery->where('nomor_identitas', '!=', $except->nomor_identitas);
        }

        return $studentQuery->exists()
            || $employeeQuery->exists()
            || Admin::where('email', $email)->exists();
    }

    private function lockVerification(
        string $accountType,
        string $accountId,
        string $purpose,
        ?string $email,
        string $code,
    ): ?EmailVerificationCode {
        $verification = EmailVerificationCode::query()
            ->where('account_type', $accountType)
            ->where('account_id', $accountId)
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->where('attempts', '<', 5)
            ->latest('id')
            ->lockForUpdate();

        if ($email !== null) {
            $verification->where('email', $email);
        }

        $verification = $verification->first();

        if (! $verification) {
            return null;
        }

        if (! Hash::check($code, $verification->code_hash)) {
            $attempts = $verification->attempts + 1;
            $verification->update([
                'attempts' => $attempts,
                'consumed_at' => $attempts >= 5 ? now() : null,
            ]);

            return null;
        }

        return $verification;
    }

    private function normalizeEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    private function validationError(ValidationValidator $validator): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'message' => $validator->errors()->first(),
            'errors' => $validator->errors(),
        ], 422);
    }

    private function invalidCodeResponse(): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Kode tidak valid atau sudah kedaluwarsa. Minta kode baru lalu coba lagi.',
        ], 422);
    }
}
