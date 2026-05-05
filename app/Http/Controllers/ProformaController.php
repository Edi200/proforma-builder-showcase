<?php

namespace App\Http\Controllers;

use App\Enums\ProformaStatus;
use App\Http\Requests\Proforma\StoreProformaRequest;
use App\Http\Requests\Proforma\UpdateProformaRequest;
use App\Mail\ProformaMailable;
use App\Models\Client;
use App\Models\CompanySetting;
use App\Models\MachineTemplate;
use App\Models\Proforma;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ProformaController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        $proformas = Proforma::query()
            ->leftJoin('clients', 'clients.id', '=', 'proformas.client_id')
            ->select('proformas.*')
            ->with(['client:id,name,email'])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $innerQuery) use ($search): void {
                    $innerQuery
                        ->where('proformas.number', 'like', "%{$search}%")
                        ->orWhere('clients.name', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('proformas.created_at')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('proformas/index', [
            'proformas' => $proformas,
            'search' => $search,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('proformas/create', [
            'clients' => $this->clientsForSelect(),
            'machineTemplates' => $this->machineTemplatesForEditor(),
        ]);
    }

    public function store(StoreProformaRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated): void {
            $items = $this->normalizeItems($validated['items']);
            $totals = $this->calculateTotals($items);

            $proforma = Proforma::query()->create([
                'client_id' => $validated['client_id'],
                'machine_template_id' => $validated['machine_template_id'] ?? null,
                'title' => $validated['title'] ?? null,
                'status' => ProformaStatus::Draft,
                'issue_date' => $validated['issue_date'],
                'due_date' => $validated['due_date'] ?? null,
                'delivery_location' => $validated['delivery_location'] ?? null,
                'delivery_time' => $validated['delivery_time'] ?? null,
                'currency' => $validated['currency'],
                'exchange_rate' => $validated['exchange_rate'] ?? null,
                'spec_fields' => $validated['spec_fields'] ?? [],
                'included_features' => $validated['included_features'] ?? [],
                'optional_extras' => $validated['optional_extras'] ?? [],
                'images' => $validated['images'] ?? [],
                'notes' => $validated['notes'] ?? null,
                'subtotal' => $totals['subtotal'],
                'tax_amount' => $totals['tax_amount'],
                'total' => $totals['total'],
            ]);

            $proforma->items()->createMany($items);
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Proforma created successfully.'),
        ]);

        return to_route('proformas.index');
    }

    public function edit(Proforma $proforma): Response
    {
        $proforma->load([
            'client:id,name',
            'items',
        ]);

        return Inertia::render('proformas/edit', [
            'proforma' => $proforma,
            'clients' => $this->clientsForSelect(),
            'machineTemplates' => $this->machineTemplatesForEditor(),
        ]);
    }

    public function update(UpdateProformaRequest $request, Proforma $proforma): RedirectResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated, $proforma): void {
            $items = $this->normalizeItems($validated['items']);
            $totals = $this->calculateTotals($items);

            $proforma->update([
                'client_id' => $validated['client_id'],
                'machine_template_id' => $validated['machine_template_id'] ?? null,
                'title' => $validated['title'] ?? null,
                'issue_date' => $validated['issue_date'],
                'due_date' => $validated['due_date'] ?? null,
                'delivery_location' => $validated['delivery_location'] ?? null,
                'delivery_time' => $validated['delivery_time'] ?? null,
                'currency' => $validated['currency'],
                'exchange_rate' => $validated['exchange_rate'] ?? null,
                'spec_fields' => $validated['spec_fields'] ?? [],
                'included_features' => $validated['included_features'] ?? [],
                'optional_extras' => $validated['optional_extras'] ?? [],
                'images' => $validated['images'] ?? [],
                'notes' => $validated['notes'] ?? null,
                'subtotal' => $totals['subtotal'],
                'tax_amount' => $totals['tax_amount'],
                'total' => $totals['total'],
            ]);

            $proforma->items()->delete();
            $proforma->items()->createMany($items);
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Proforma updated successfully.'),
        ]);

        return to_route('proformas.index');
    }

    public function destroy(Proforma $proforma): RedirectResponse
    {
        Proforma::query()
            ->whereKey($proforma)
            ->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Proforma deleted successfully.'),
        ]);

        return to_route('proformas.index');
    }

    public function duplicate(Proforma $proforma): RedirectResponse
    {
        $copy = DB::transaction(function () use ($proforma): Proforma {
            $proforma->loadMissing('items');

            $copy = Proforma::query()->create([
                'client_id' => null,
                'machine_template_id' => $proforma->machine_template_id,
                'title' => $proforma->title,
                'status' => ProformaStatus::Draft,
                'issue_date' => $proforma->issue_date,
                'due_date' => $proforma->due_date,
                'delivery_location' => $proforma->delivery_location,
                'delivery_time' => $proforma->delivery_time,
                'currency' => $proforma->currency,
                'exchange_rate' => $proforma->exchange_rate,
                'spec_fields' => $proforma->spec_fields ?? [],
                'included_features' => $proforma->included_features ?? [],
                'optional_extras' => $proforma->optional_extras ?? [],
                'images' => $proforma->images ?? [],
                'notes' => $proforma->notes,
                'subtotal' => $proforma->subtotal,
                'tax_amount' => $proforma->tax_amount,
                'total' => $proforma->total,
            ]);

            $copy->items()->createMany(
                $proforma->items
                    ->map(static fn ($item): array => [
                        'description' => $item->description,
                        'chassis_number' => $item->chassis_number,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'tax_rate' => $item->tax_rate,
                        'total' => $item->total,
                    ])
                    ->all()
            );

            return $copy;
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Proforma duplicated successfully.'),
        ]);

        return to_route('proformas.edit', $copy);
    }

    public function send(Request $request, Proforma $proforma): RedirectResponse
    {
        $validated = $request->validate([
            'to' => ['required', 'array', 'min:1'],
            'to.*' => ['required', 'email'],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:2000'],
        ]);

        $proforma->loadMissing([
            'client',
            'items',
        ]);

        $pdfContent = $this->buildPdf($proforma)->output();

        Mail::to($validated['to'])->send(
            new ProformaMailable(
                $proforma,
                $validated['subject'],
                $validated['message'] ?? '',
                $pdfContent
            )
        );

        $proforma->update([
            'status' => ProformaStatus::Sent,
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Proforma sent successfully.'),
        ]);

        return back();
    }

    public function updateStatus(Request $request, Proforma $proforma): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in([
                ProformaStatus::Draft->value,
                ProformaStatus::Sent->value,
                ProformaStatus::Accepted->value,
                ProformaStatus::Cancelled->value,
            ])],
        ]);

        $proforma->update([
            'status' => $validated['status'],
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Proforma status updated successfully.'),
        ]);

        return back();
    }

    public function preview(Proforma $proforma): HttpResponse
    {
        $pdf = $this->buildPdf($proforma);

        return $pdf->stream("{$proforma->number}.pdf");
    }

    public function pdf(Proforma $proforma): HttpResponse
    {
        $pdf = $this->buildPdf($proforma);

        return $pdf->download("{$proforma->number}.pdf");
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    private function clientsForSelect(): array
    {
        return Client::query()
            ->select(['id', 'name'])
            ->orderBy('name', 'asc')
            ->get()
            ->toArray();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function machineTemplatesForEditor(): array
    {
        return MachineTemplate::query()
            ->select(['id', 'name', 'base_price', 'spec_fields', 'included_features', 'optional_extras', 'images'])
            ->orderBy('name', 'asc')
            ->get()
            ->toArray();
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    private function normalizeItems(array $items): array
    {
        return array_map(static function (array $item): array {
            return [
                'description' => trim((string) $item['description']),
                'chassis_number' => filled($item['chassis_number'] ?? null)
                    ? trim((string) $item['chassis_number'])
                    : null,
                'quantity' => (float) $item['quantity'],
                'unit_price' => (float) $item['unit_price'],
                'tax_rate' => (float) $item['tax_rate'],
                'total' => (float) $item['total'],
            ];
        }, $items);
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array{subtotal: float, tax_amount: float, total: float}
     */
    private function calculateTotals(array $items): array
    {
        $subtotal = 0.0;
        $taxAmount = 0.0;

        foreach ($items as $item) {
            $lineSubtotal = ((float) $item['quantity']) * ((float) $item['unit_price']);
            $lineTaxAmount = $lineSubtotal * ((float) $item['tax_rate']) / 100;

            $subtotal += $lineSubtotal;
            $taxAmount += $lineTaxAmount;
        }

        $subtotal = round($subtotal, 2);
        $taxAmount = round($taxAmount, 2);

        return [
            'subtotal' => $subtotal,
            'tax_amount' => $taxAmount,
            'total' => round($subtotal + $taxAmount, 2),
        ];
    }

    private function buildPdf(Proforma $proforma): DomPdf
    {
        $proforma->loadMissing([
            'client',
            'items',
        ]);

        /** @var array<string, string|null> $companySettings */
        $companySettings = CompanySetting::query()
            ->pluck('value', 'key')
            ->toArray();

        $logoPath = $this->resolveCompanyLogoPath($companySettings);
        $imagePaths = $this->resolveProformaImagePaths($proforma);

        return Pdf::loadView('pdf.proforma', [
            'proforma' => $proforma,
            'companySettings' => $companySettings,
            'logoPath' => $logoPath,
            'imagePaths' => $imagePaths,
        ])->setPaper('a4', 'portrait');
    }

    /**
     * @param  array<string, string|null>  $companySettings
     */
    private function resolveCompanyLogoPath(array $companySettings): ?string
    {
        $logoValue = $companySettings['company_logo_path'] ?? null;

        if (is_string($logoValue) && $logoValue !== '') {
            $logoCandidate = public_path(ltrim($logoValue, '/'));

            if (is_file($logoCandidate)) {
                return $logoCandidate;
            }
        }

        $fallbackPath = public_path('images/logo.png');

        return is_file($fallbackPath) ? $fallbackPath : null;
    }

    /**
     * @return array<int, string>
     */
    private function resolveProformaImagePaths(Proforma $proforma): array
    {
        $paths = [];

        foreach ((array) ($proforma->images ?? []) as $image) {
            if (! is_string($image) || $image === '') {
                continue;
            }

            $resolved = $this->resolveSingleProformaImagePath($image);

            if ($resolved !== null) {
                $paths[] = $resolved;
            }

            if (count($paths) === 2) {
                break;
            }
        }

        return $paths;
    }

    private function resolveSingleProformaImagePath(string $image): ?string
    {
        $imagePath = parse_url($image, PHP_URL_PATH);
        $normalized = is_string($imagePath) && $imagePath !== '' ? $imagePath : $image;
        $normalized = ltrim($normalized, '/');

        $candidates = [
            public_path($normalized),
            storage_path('app/public/'.$normalized),
        ];

        if (str_starts_with($normalized, 'storage/')) {
            $candidates[] = storage_path('app/public/'.ltrim(substr($normalized, 8), '/'));
        }

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
