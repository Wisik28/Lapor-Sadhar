<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VerificationCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $code,
        public readonly string $purpose,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Kode verifikasi Lapor Sadhar');
    }

    public function content(): Content
    {
        return new Content(
            text: 'emails.verification-code',
            with: [
                'code' => $this->code,
                'purposeMessage' => $this->purpose === 'email_change'
                    ? 'Kode ini digunakan untuk memverifikasi permintaan perubahan email.'
                    : 'Kode ini digunakan untuk mereset kata sandi.',
            ],
        );
    }
}
