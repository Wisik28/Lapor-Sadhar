<?php

namespace App\Services;

use App\Mail\VerificationCodeMail;
use App\Models\EmailVerificationCode;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Throwable;

class EmailCodeService
{
    public function send(
        string $accountType,
        string $accountId,
        string $purpose,
        string $email,
        ?string $targetEmail = null,
    ): void {
        $code = (string) random_int(100000, 999999);

        EmailVerificationCode::query()
            ->where('account_type', $accountType)
            ->where('account_id', $accountId)
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        $verification = EmailVerificationCode::create([
            'account_type' => $accountType,
            'account_id' => $accountId,
            'purpose' => $purpose,
            'email' => $email,
            'target_email' => $targetEmail,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(10),
        ]);

        try {
            Mail::to($email)->send(new VerificationCodeMail($code, $purpose));
        } catch (Throwable $exception) {
            $verification->update(['consumed_at' => now()]);
            throw $exception;
        }
    }
}
