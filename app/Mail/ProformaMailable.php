<?php

namespace App\Mail;

use App\Models\CompanySetting;
use App\Models\Proforma;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProformaMailable extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Proforma $proforma,
        private string $subjectLine,
        string $message,
        private string $pdfContent
    ) {
        $this->customMessage = $message;
    }

    public string $customMessage;

    public function envelope(): Envelope
    {
        $companyEmail = CompanySetting::get('company_email');

        return new Envelope(
            subject: $this->subjectLine,
            replyTo: is_string($companyEmail) && $companyEmail !== ''
                ? [new Address($companyEmail)]
                : [],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.proforma',
            with: [
                'proforma' => $this->proforma,
                'customMessage' => $this->customMessage,
                'companyName' => CompanySetting::get('company_name', 'Company'),
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdfContent, "{$this->proforma->number}.pdf")
                ->withMime('application/pdf'),
        ];
    }
}
