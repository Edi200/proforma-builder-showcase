<?php

namespace App\Models;

use App\Enums\ProformaStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Proforma extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'client_id',
        'machine_template_id',
        'number',
        'title',
        'status',
        'issue_date',
        'due_date',
        'delivery_location',
        'delivery_time',
        'currency',
        'exchange_rate',
        'spec_fields',
        'included_features',
        'optional_extras',
        'images',
        'notes',
        'subtotal',
        'tax_amount',
        'total',
    ];

    protected static function booted(): void
    {
        static::creating(function (Proforma $proforma): void {
            if (! empty($proforma->number)) {
                return;
            }

            $year = now()->year;
            $prefix = "PRF-{$year}-";

            $numbers = static::query()
                ->withTrashed()
                ->where('number', 'like', "{$prefix}%")
                ->orderByDesc('number')
                ->pluck('number');

            $nextSequence = 1;

            foreach ($numbers as $number) {
                if (! is_string($number)) {
                    continue;
                }

                $suffix = str($number)->afterLast('-')->toString();

                if (ctype_digit($suffix)) {
                    $nextSequence = (int) $suffix + 1;
                    break;
                }
            }

            $proforma->number = $prefix.str_pad((string) $nextSequence, 4, '0', STR_PAD_LEFT);
        });
    }

    protected function casts(): array
    {
        return [
            'status' => ProformaStatus::class,
            'issue_date' => 'date',
            'exchange_rate' => 'decimal:6',
            'spec_fields' => 'array',
            'included_features' => 'array',
            'optional_extras' => 'array',
            'images' => 'array',
            'subtotal' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function machineTemplate(): BelongsTo
    {
        return $this->belongsTo(MachineTemplate::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ProformaItem::class);
    }
}
