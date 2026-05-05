@php
    $companyName = $companySettings['company_name'] ?? '';
    $companyAddress = $companySettings['company_address'] ?? '';
    $companyCity = $companySettings['company_city'] ?? '';
    $companyCountry = $companySettings['company_country'] ?? '';
    $companyPhone = $companySettings['company_phone'] ?? '';
    $companyEmail = $companySettings['company_email'] ?? '';
    $companyWebsite = $companySettings['company_website'] ?? '';
    $companyTaxNumber = $companySettings['company_tax_number'] ?? '';
    $companyRegistrationNumber = $companySettings['company_registration_number'] ?? '';
    $companyBankAccount = $companySettings['company_bank_account'] ?? '';
    $companyBankAccounts = json_decode((string) ($companySettings['company_bank_accounts'] ?? '[]'), true);
    $companyBankAccounts = collect(is_array($companyBankAccounts) ? $companyBankAccounts : [])
        ->filter(fn ($account) => is_array($account))
        ->map(function (array $account): string {
            $bankName = trim((string) ($account['bank_name'] ?? ''));
            $accountNumber = trim((string) ($account['account_number'] ?? ''));

            if ($bankName === '' && $accountNumber === '') {
                return '';
            }

            if ($bankName === '') {
                return $accountNumber;
            }

            if ($accountNumber === '') {
                return $bankName;
            }

            return $bankName.': '.$accountNumber;
        })
        ->filter(fn (string $accountLine) => $accountLine !== '');

    $specFields = collect($proforma->spec_fields ?? [])->filter(fn ($field) => is_array($field));
    $includedFeatures = collect($proforma->included_features ?? [])->filter(fn ($feature) => is_string($feature) && trim($feature) !== '');
    $optionalExtras = collect($proforma->optional_extras ?? [])->filter(fn ($extra) => is_string($extra) && trim($extra) !== '');

    $dimensions = [
        'length' => null,
        'width' => null,
        'height' => null,
    ];

    foreach ($specFields as $field) {
        $key = mb_strtolower(trim((string) ($field['key'] ?? '')));
        $value = trim((string) ($field['value'] ?? ''));

        if ($value === '') {
            continue;
        }

        if ($dimensions['length'] === null && str_contains($key, 'length')) {
            $dimensions['length'] = $value;
        }

        if ($dimensions['width'] === null && str_contains($key, 'width')) {
            $dimensions['width'] = $value;
        }

        if ($dimensions['height'] === null && str_contains($key, 'height')) {
            $dimensions['height'] = $value;
        }
    }

    $currencySymbols = [
        'EUR' => '€',
        'RSD' => 'RSD',
        'HUF' => 'Ft',
    ];

    $currency = $proforma->currency;
    $currencySymbol = $currencySymbols[$currency] ?? $currency;
    $baseSubtotal = (float) $proforma->subtotal;
    $vatAmount = (float) $proforma->tax_amount;
    $grandTotal = $baseSubtotal + $vatAmount;
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Proforma {{ $proforma->number }}</title>
    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            color: #111827;
            line-height: 1.35;
        }
        .page {
            width: 100%;
        }
        .mb-10 {
            margin-bottom: 10px;
        }
        .mb-16 {
            margin-bottom: 16px;
        }
        .mb-20 {
            margin-bottom: 20px;
        }
        .mb-24 {
            margin-bottom: 24px;
        }
        .small {
            font-size: 10px;
        }
        .muted {
            color: #4b5563;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .title {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .company-name {
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 4px;
        }
        .section-title {
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 6px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        .header-table td {
            vertical-align: top;
        }
        .header-left {
            width: 45%;
        }
        .header-right {
            width: 55%;
        }
        .logo {
            max-width: 170px;
            max-height: 70px;
            margin-bottom: 8px;
        }
        .meta-table td {
            padding: 2px 0;
            vertical-align: top;
        }
        .meta-label {
            width: 150px;
            font-weight: 700;
        }
        .client-box {
            border: 1px solid #d1d5db;
            padding: 8px;
        }
        .client-name {
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 6px;
        }
        .items-table th,
        .items-table td {
            border: 1px solid #1f2937;
            padding: 6px;
            vertical-align: top;
        }
        .items-table th {
            background: #f3f4f6;
            font-weight: 700;
            text-align: center;
        }
        .num-col {
            width: 42px;
            text-align: center;
        }
        .money-col {
            width: 115px;
            text-align: center;
            white-space: nowrap;
        }
        .desc-cell {
            width: auto;
        }
        .desc-main {
            font-weight: 700;
            margin-bottom: 4px;
        }
        .spec-table {
            width: 105%;
            border-collapse: collapse;
            margin-top: 0;
            margin-left: -6px;
            margin-right: -6px;
            border: none;
        }
        .spec-table td {
            border: none;
            border-top: 1px solid #1f2937;
            padding: 3px 6px;
            font-size: 10px;
        }
        .spec-table tr:first-child td {
            border-top: none;
        }
        .spec-machine-name {
            font-weight: 700;
        }
        .spec-key {
            width: 45%;
            color: #374151;
            font-weight: 700;
        }
        .first-item-cell {
            vertical-align: middle !important;
        }
        .totals-row td {
            font-weight: 700;
            background: #f9fafb;
        }
        .two-column td {
            width: 50%;
            vertical-align: top;
            padding-right: 10px;
        }
        .list {
            margin: 0;
            padding-left: 16px;
        }
        .list li {
            margin-bottom: 3px;
        }
        .images-table td {
            width: 50%;
            border: 1px solid #d1d5db;
            padding: 6px;
            text-align: center;
            vertical-align: middle;
            height: 130px;
        }
        .machine-image {
            max-width: 100%;
            max-height: 118px;
        }
        .signature {
            margin-top: 22px;
            text-align: right;
            font-weight: 700;
        }
    </style>
</head>
<body>
<div class="page">
    <table class="header-table mb-20">
        <tr>
            <td class="header-left">
                @if ($logoPath)
                    <img src="{{ $logoPath }}" alt="Company logo" class="logo">
                @endif
                <div class="company-name">{{ $companyName }}</div>
                <div>{{ $companyAddress }}</div>
                <div>{{ trim($companyCity.' '.$companyCountry) }}</div>
            </td>
            <td class="header-right text-right">
                <div>{{ $companyPhone }}</div>
                <div>{{ $companyEmail }}</div>
                <div>PIB: {{ $companyTaxNumber }}</div>
                <div>MB: {{ $companyRegistrationNumber }}</div>
                @if ($companyBankAccounts->isNotEmpty())
                    @foreach ($companyBankAccounts as $accountLine)
                        <div>{{ $accountLine }}</div>
                    @endforeach
                @elseif ($companyBankAccount !== '')
                    <div>{{ $companyBankAccount }}</div>
                @endif
            </td>
        </tr>
    </table>

    <table class="mb-16">
        <tr>
            <td style="width: 58%; vertical-align: top; padding-right: 12px;">
                <div class="title">PROFORMA INVOICE No: {{ $proforma->number }}</div>
                <table class="meta-table">
                    <tr>
                        <td class="meta-label">Issue location:</td>
                        <td>{{ $proforma->delivery_location ?? '-' }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Issue date:</td>
                        <td>{{ optional($proforma->issue_date)->format('d.m.Y') }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Payment deadline:</td>
                        <td>{{ $proforma->due_date ? $proforma->due_date.' days' : '-' }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Delivery location:</td>
                        <td>{{ $proforma->delivery_location ?? '-' }}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Delivery time:</td>
                        <td>{{ $proforma->delivery_time ?? '-' }}</td>
                    </tr>
                </table>
            </td>
            <td style="width: 42%; vertical-align: top;">
                <div class="client-box">
                    <div class="client-name">{{ $proforma->client?->name ?? '-' }}</div>
                    <div>{{ $proforma->client?->address ?? '' }}</div>
                    <div>{{ trim(($proforma->client?->city ?? '').' '.($proforma->client?->country ?? '')) }}</div>
                    <div>PIB: {{ $proforma->client?->tax_number ?? '-' }}</div>
                    <div>MB: {{ $proforma->client?->registration_number ?? '-' }}</div>
                </div>
            </td>
        </tr>
    </table>

    <table class="items-table mb-16">
        <thead>
        <tr>
            <th class="num-col">#</th>
            <th>Description</th>
            <th class="money-col">Base Amount</th>
            <th class="money-col">VAT 20%</th>
            <th class="money-col">Total Amount</th>
        </tr>
        </thead>
        <tbody>
        @foreach ($proforma->items as $index => $item)
            @php
                $isGratis = (float) $item->unit_price === 0.0 && (float) $item->tax_rate === 0.0;
                $lineBase = $isGratis ? 0.0 : ((float) $item->quantity * (float) $item->unit_price);
                $lineVat = $isGratis ? 0.0 : ($lineBase * ((float) $item->tax_rate / 100));
                $lineTotal = $isGratis ? 0.0 : ($lineBase + $lineVat);
            @endphp
            <tr>
                <td class="num-col{{ $index === 0 ? ' first-item-cell' : '' }}">{{ $index + 1 }}</td>
                <td class="desc-cell">
                    @if ($index === 0 && $specFields->isNotEmpty())
                        <table class="spec-table">
                            <tr>
                                <td colspan="2" class="spec-machine-name">{{ $item->description }}</td>
                            </tr>
                            @foreach ($specFields as $field)
                                <tr>
                                    <td class="spec-key">{{ $field['key'] ?? '' }}</td>
                                    <td>{{ $field['value'] ?? '' }}</td>
                                </tr>
                            @endforeach
                        </table>
                    @else
                        <div class="desc-main">{{ $item->description }}</div>
                    @endif
                </td>
                <td class="money-col{{ $index === 0 ? ' first-item-cell' : '' }}">{{ number_format($lineBase, 2, ',', '.') }}</td>
                <td class="money-col{{ $index === 0 ? ' first-item-cell' : '' }}">{{ number_format($lineVat, 2, ',', '.') }}</td>
                <td class="money-col{{ $index === 0 ? ' first-item-cell' : '' }}">{{ number_format($lineTotal, 2, ',', '.') }}</td>
            </tr>
        @endforeach
        <tr class="totals-row">
            <td colspan="2" class="text-right">Total for this proforma</td>
            <td class="money-col">{{ number_format($baseSubtotal, 2, ',', '.') }}</td>
            <td class="money-col">{{ number_format($vatAmount, 2, ',', '.') }}</td>
            <td class="money-col">{{ number_format($grandTotal, 2, ',', '.') }}</td>
        </tr>
        </tbody>
    </table>

    <table class="two-column mb-16">
        <tr>
            <td>
                <div class="section-title">Included in price:</div>
                @if ($includedFeatures->isNotEmpty())
                    <ul class="list">
                        @foreach ($includedFeatures as $feature)
                            <li>{{ $feature }}</li>
                        @endforeach
                    </ul>
                @else
                    <div class="small muted">No included features listed.</div>
                @endif
            </td>
            <td>
                <div class="section-title">Also available (not included in price):</div>
                @if ($optionalExtras->isNotEmpty())
                    <ul class="list">
                        @foreach ($optionalExtras as $extra)
                            <li>{{ $extra }}</li>
                        @endforeach
                    </ul>
                @else
                    <div class="small muted">No optional extras listed.</div>
                @endif
            </td>
        </tr>
    </table>

    @if ($dimensions['length'] || $dimensions['width'] || $dimensions['height'])
        <div class="mb-16">
            <strong>Dimensions:</strong>
            @if ($dimensions['length']) Length: {{ $dimensions['length'] }}; @endif
            @if ($dimensions['width']) Width: {{ $dimensions['width'] }}; @endif
            @if ($dimensions['height']) Height: {{ $dimensions['height'] }} @endif
        </div>
    @endif

    <div class="mb-10">
        {{ $proforma->notes ?? '' }}
    </div>

    @if (! empty($imagePaths))
        <table class="images-table mb-16">
            <tr>
                <td>
                    @if (isset($imagePaths[0]))
                        <img src="{{ $imagePaths[0] }}" alt="Machine image 1" class="machine-image">
                    @endif
                </td>
                <td>
                    @if (isset($imagePaths[1]))
                        <img src="{{ $imagePaths[1] }}" alt="Machine image 2" class="machine-image">
                    @endif
                </td>
            </tr>
        </table>
    @endif

    <div class="mb-10">This proforma is valid without stamp and signature.</div>
    <div class="mb-10">
        All prices are expressed in {{ $currencySymbol }}.
        @if (in_array($currency, ['RSD', 'HUF'], true) && $proforma->exchange_rate !== null)
            Exchange rate: 1 EUR = {{ number_format((float) $proforma->exchange_rate, 6, ',', '.') }} {{ $currency }}.
        @endif
    </div>

    <div class="signature">BUYER: ____________________</div>
</div>
</body>
</html>
