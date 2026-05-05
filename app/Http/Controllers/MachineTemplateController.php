<?php

namespace App\Http\Controllers;

use App\Http\Requests\MachineTemplate\StoreMachineTemplateRequest;
use App\Http\Requests\MachineTemplate\UpdateMachineTemplateRequest;
use App\Models\MachineTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Inertia\Inertia;
use Inertia\Response;

class MachineTemplateController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        $machineTemplates = MachineTemplate::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%");
            })
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('machine-templates/index', [
            'machineTemplates' => $machineTemplates,
            'search' => $search,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('machine-templates/create');
    }

    public function store(StoreMachineTemplateRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        if (isset($validated['optional_extras'])) {
            $validated['optional_extras'] = array_map(function ($extra) {
                $extra['is_gratis'] = (bool) ($extra['is_gratis'] ?? false);
                $extra['price'] = (float) ($extra['price'] ?? 0);

                return $extra;
            }, $validated['optional_extras']);
        }

        $uploadedImagePaths = $this->storeUploadedImages($request->file('images', []));

        unset($validated['images'], $validated['retained_images']);
        $validated['images'] = $uploadedImagePaths;

        MachineTemplate::create($validated);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Machine template created successfully.'),
        ]);

        return to_route('machine-templates.index');
    }

    public function edit(MachineTemplate $machineTemplate): Response
    {
        return Inertia::render('machine-templates/edit', [
            'machineTemplate' => $machineTemplate,
        ]);
    }

    public function update(
        UpdateMachineTemplateRequest $request,
        MachineTemplate $machineTemplate
    ): RedirectResponse {
        $validated = $request->validated();

        if (isset($validated['optional_extras'])) {
            $validated['optional_extras'] = array_map(function ($extra) {
                $extra['is_gratis'] = (bool) ($extra['is_gratis'] ?? false);
                $extra['price'] = (float) ($extra['price'] ?? 0);

                return $extra;
            }, $validated['optional_extras']);
        }

        $currentImages = collect($machineTemplate->images ?? [])
            ->filter(fn ($path) => is_string($path) && $path !== '')
            ->values();
        $hasRetainedImagesInput = $request->exists('retained_images');
        $retainedImagesInput = $hasRetainedImagesInput
            ? ($validated['retained_images'] ?? [])
            : $currentImages->all();
        $retainedImages = collect($retainedImagesInput)
            ->filter(fn ($path) => is_string($path) && $path !== '' && $path !== '__EMPTY_ARRAY__')
            ->values();
        $uploadedImagePaths = $this->storeUploadedImages($request->file('images', []));

        $removedImages = $currentImages->diff($retainedImages)->values();

        foreach ($removedImages as $removedImagePath) {
            $this->deletePublicImage($removedImagePath);
        }

        unset($validated['images'], $validated['retained_images']);
        $validated['images'] = $retainedImages
            ->merge($uploadedImagePaths)
            ->unique()
            ->values()
            ->all();

        $machineTemplate->update($validated);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Machine template updated successfully.'),
        ]);

        return to_route('machine-templates.index');
    }

    public function destroy(MachineTemplate $machineTemplate): RedirectResponse
    {
        MachineTemplate::query()
            ->whereKey($machineTemplate)
            ->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Machine template deleted successfully.'),
        ]);

        return to_route('machine-templates.index');
    }

    public function duplicate(MachineTemplate $machineTemplate): RedirectResponse
    {
        $copy = MachineTemplate::query()->create([
            'name' => __('Copy of :name', ['name' => $machineTemplate->name]),
            'base_price' => $machineTemplate->base_price,
            'spec_fields' => $machineTemplate->spec_fields,
            'included_features' => $machineTemplate->included_features,
            'optional_extras' => $machineTemplate->optional_extras,
            'images' => [],
            'notes' => $machineTemplate->notes,
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Machine template duplicated successfully.'),
        ]);

        return to_route('machine-templates.edit', $copy);
    }

    /**
     * @param  array<int, \Illuminate\Http\UploadedFile>|null  $images
     * @return array<int, string>
     */
    private function storeUploadedImages(?array $images): array
    {
        if ($images === null) {
            return [];
        }

        $storedPaths = [];
        $disk = Storage::disk('public');
        $imageManager = ImageManager::usingDriver(Driver::class);

        foreach ($images as $image) {
            $storedPath = $image->store('machine-templates', 'public');
            $originalAbsolutePath = $disk->path($storedPath);
            $directory = pathinfo($storedPath, PATHINFO_DIRNAME);
            $filename = pathinfo($storedPath, PATHINFO_FILENAME);
            $optimizedPath = ($directory === '.' ? '' : $directory.'/').$filename.'.jpg';

            $optimizedImage = $imageManager->decodePath($originalAbsolutePath)
                ->scaleDown(width: 1200)
                ->encodeUsingFileExtension('jpg', quality: 80);

            $disk->put($optimizedPath, (string) $optimizedImage);

            if ($optimizedPath !== $storedPath) {
                $disk->delete($storedPath);
            }

            $storedPaths[] = Storage::url($optimizedPath);
        }

        return $storedPaths;
    }

    private function deletePublicImage(string $publicPath): void
    {
        $relativePath = ltrim(str_replace('/storage/', '', $publicPath), '/');

        if ($relativePath === '') {
            return;
        }

        Storage::disk('public')->delete($relativePath);
    }
}
