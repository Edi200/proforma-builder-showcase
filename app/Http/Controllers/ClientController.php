<?php

namespace App\Http\Controllers;

use App\Http\Requests\Client\StoreClientRequest;
use App\Http\Requests\Client\UpdateClientRequest;
use App\Models\Client;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Inertia\Inertia;
use Inertia\Response;

class ClientController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        $clients = Client::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%")
                        ->orWhere('tax_number', 'like', "%{$search}%")
                        ->orWhere('registration_number', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('clients/index', [
            'clients' => $clients,
            'search' => $search,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('clients/create');
    }

    public function store(StoreClientRequest $request): RedirectResponse
    {
        Client::create($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Client created successfully.'),
        ]);

        return to_route('clients.index');
    }

    public function edit(Client $client): Response
    {
        return Inertia::render('clients/edit', [
            'client' => $client,
        ]);
    }

    public function update(UpdateClientRequest $request, Client $client): RedirectResponse
    {
        $client->update($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Client updated successfully.'),
        ]);

        return to_route('clients.index');
    }

    public function destroy(Client $client): RedirectResponse
    {
        Client::query()
            ->whereKey($client)
            ->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Client deleted successfully.'),
        ]);

        return to_route('clients.index');
    }

    public function import(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        $handle = fopen($validated['file']->getRealPath(), 'r');

        if ($handle === false) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => __('Unable to read the uploaded CSV file.'),
            ]);

            return to_route('clients.index');
        }

        // Skip header row.
        fgetcsv($handle);

        $importedCount = 0;

        while (($row = fgetcsv($handle)) !== false) {
            $values = array_pad($row, 9, null);
            $values = array_map(
                static fn ($value): ?string => is_string($value) ? trim($value) : null,
                $values
            );

            [
                $name,
                $taxNumber,
                $registrationNumber,
                $address,
                $city,
                $country,
                $email,
                $phone,
                $notes,
            ] = $values;

            if (blank($name)) {
                continue;
            }

            $payload = [
                'name' => $name,
                'tax_number' => filled($taxNumber) ? $taxNumber : null,
                'registration_number' => filled($registrationNumber) ? $registrationNumber : null,
                'address' => filled($address) ? $address : null,
                'city' => filled($city) ? $city : null,
                'country' => filled($country) ? $country : null,
                'email' => filled($email) ? $email : null,
                'phone' => filled($phone) ? $phone : null,
                'notes' => filled($notes) ? $notes : null,
            ];

            if (filled($email)) {
                Client::query()->updateOrCreate(
                    ['email' => $email],
                    $payload
                );
            } else {
                Client::query()->create($payload);
            }

            $importedCount++;
        }

        fclose($handle);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Imported :count client records.', ['count' => $importedCount]),
        ]);

        return to_route('clients.index');
    }

    public function importTemplate(): StreamedResponse
    {
        return response()->streamDownload(function (): void {
            $handle = fopen('php://output', 'w');

            if ($handle === false) {
                return;
            }

            fputcsv($handle, [
                'name',
                'tax_number',
                'registration_number',
                'address',
                'city',
                'country',
                'email',
                'phone',
                'notes',
            ]);

            fclose($handle);
        }, 'clients-import-template.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }
}
