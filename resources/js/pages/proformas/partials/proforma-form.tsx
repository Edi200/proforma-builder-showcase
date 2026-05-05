import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
    ProformaCurrency,
    ProformaFormData,
    ProformaSelectableClient,
    ProformaSelectableTemplate,
    ProformaTemplateExtra,
} from '@/types';

type ProformaFormErrors = Partial<Record<string, string>>;

type ProformaFormProps = {
    data: ProformaFormData;
    errors: ProformaFormErrors;
    processing: boolean;
    submitLabel: string;
    clients: ProformaSelectableClient[];
    machineTemplates: ProformaSelectableTemplate[];
    onCancel: () => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    setData: <K extends keyof ProformaFormData>(key: K, value: ProformaFormData[K]) => void;
};

type ComboboxOption = {
    value: string;
    label: string;
};

function Combobox({
    value,
    onValueChange,
    options,
    placeholder,
    searchPlaceholder,
    emptyLabel,
}: {
    value: string;
    onValueChange: (value: string) => void;
    options: ComboboxOption[];
    placeholder: string;
    searchPlaceholder: string;
    emptyLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const selectedOption = options.find((option) => option.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {selectedOption?.label ?? placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyLabel}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onValueChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value === option.value ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function normalizeExtraName(extra: ProformaTemplateExtra): string {
    return typeof extra === 'string' ? extra : extra.name ?? '';
}

function normalizeExtraPrice(extra: ProformaTemplateExtra): number {
    if (typeof extra === 'string') {
        return 0;
    }

    return extra.is_gratis ? 0 : Number(extra.price ?? 0);
}

function isExtraGratis(extra: ProformaTemplateExtra): boolean {
    if (typeof extra === 'string') {
        return false;
    }

    return Boolean(extra.is_gratis);
}

function convertEurPrice(
    amount: number,
    currency: ProformaCurrency,
    exchangeRate: number | ''
): number {
    if (currency === 'EUR') {
        return amount;
    }

    const rate = typeof exchangeRate === 'number' ? exchangeRate : Number(exchangeRate);

    if (Number.isNaN(rate) || rate <= 0) {
        return 0;
    }

    return amount * rate;
}

function currencySymbol(currency: ProformaCurrency): string {
    if (currency === 'EUR') {
        return 'EUR';
    }

    if (currency === 'HUF') {
        return 'Ft';
    }

    return 'RSD';
}

function calculateRowTotal(quantity: number | '', unitPrice: number | ''): number {
    const qty = typeof quantity === 'number' ? quantity : Number(quantity);
    const price = typeof unitPrice === 'number' ? unitPrice : Number(unitPrice);

    if (Number.isNaN(qty) || Number.isNaN(price)) {
        return 0;
    }

    return Number((qty * price).toFixed(2));
}

export default function ProformaForm({
    data,
    errors,
    processing,
    submitLabel,
    clients,
    machineTemplates,
    onCancel,
    onSubmit,
    setData,
}: ProformaFormProps) {
    const clientOptions = useMemo<ComboboxOption[]>(
        () =>
            clients.map((client) => ({
                value: String(client.id),
                label: client.name,
            })),
        [clients]
    );

    const templateOptions = useMemo<ComboboxOption[]>(
        () =>
            machineTemplates.map((template) => ({
                value: String(template.id),
                label: template.name,
            })),
        [machineTemplates]
    );

    const subtotal = useMemo(
        () =>
            data.items.reduce((sum, item) => {
                const rowSubtotal = calculateRowTotal(item.quantity, item.unit_price);

                return sum + rowSubtotal;
            }, 0),
        [data.items]
    );

    const taxAmount = useMemo(
        () =>
            data.items.reduce((sum, item) => {
                const rowSubtotal = calculateRowTotal(item.quantity, item.unit_price);
                const taxRate = typeof item.tax_rate === 'number' ? item.tax_rate : Number(item.tax_rate);

                return sum + (Number.isNaN(taxRate) ? 0 : (rowSubtotal * taxRate) / 100);
            }, 0),
        [data.items]
    );

    const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

    useEffect(() => {
        setData(
            'items',
            data.items.map((item) => ({
                ...item,
                total: calculateRowTotal(item.quantity, item.unit_price),
            }))
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.items.map((item) => `${item.quantity}:${item.unit_price}`).join('|')]);

    useEffect(() => {
        if (data.currency === 'EUR') {
            return;
        }

        const controller = new AbortController();

        const fetchRate = async () => {
            try {
                const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR', {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    return;
                }

                const payload = (await response.json()) as {
                    rates?: Record<string, number>;
                };

                const rate = payload.rates?.[data.currency];

                if (typeof rate === 'number' && Number.isFinite(rate)) {
                    setData('exchange_rate', Number(rate.toFixed(6)));
                }
            } catch {
                // Silent fail keeps field manually editable without blocking form.
            }
        };

        void fetchRate();

        return () => controller.abort();
    }, [data.currency, setData]);

    const applyTemplate = (templateId: number | '') => {
        setData('machine_template_id', templateId);

        if (templateId === '') {
            return;
        }

        const template = machineTemplates.find((item) => item.id === templateId);

        if (!template) {
            return;
        }

        const specFields =
            template.spec_fields && template.spec_fields.length > 0
                ? template.spec_fields.map((field) => ({
                      key: field.key ?? '',
                      value: field.value ?? '',
                  }))
                : [{ key: '', value: '' }];

        const includedFeatures =
            template.included_features && template.included_features.length > 0
                ? template.included_features
                : [''];

        const extras = template.optional_extras ?? [];
        const optionalExtras = extras.map((extra) => normalizeExtraName(extra)).filter((name) => name !== '');
        const currencyConvertedBasePrice = convertEurPrice(
            Number(template.base_price ?? 0),
            data.currency,
            data.exchange_rate
        );

        const seededItems: ProformaFormData['items'] = [
            {
                description: template.name,
                chassis_number: '',
                quantity: 1,
                unit_price: Number(currencyConvertedBasePrice.toFixed(2)),
                tax_rate: 20,
                total: Number(currencyConvertedBasePrice.toFixed(2)),
            },
            ...extras.map((extra) => {
                const converted = convertEurPrice(
                    normalizeExtraPrice(extra),
                    data.currency,
                    data.exchange_rate
                );
                const gratis = isExtraGratis(extra);

                return {
                    description: normalizeExtraName(extra),
                    chassis_number: '',
                    quantity: 1,
                    unit_price: Number(converted.toFixed(2)),
                    tax_rate: gratis ? 0 : 20,
                    total: Number(converted.toFixed(2)),
                };
            }),
        ];

        setData('spec_fields', specFields);
        setData('included_features', includedFeatures);
        setData('optional_extras', optionalExtras);
        setData('images', template.images ?? []);
        setData('items', seededItems);
    };

    return (
        <form onSubmit={onSubmit} className="space-y-8">
            <section className="space-y-4 rounded-lg border p-4">
                <h2 className="text-lg font-semibold">Header</h2>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label>Client</Label>
                        <Combobox
                            value={data.client_id === '' ? '' : String(data.client_id)}
                            onValueChange={(value) => setData('client_id', Number(value))}
                            options={clientOptions}
                            placeholder="Select client"
                            searchPlaceholder="Search clients..."
                            emptyLabel="No client found."
                        />
                        <InputError message={errors.client_id} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Machine Template</Label>
                        <Combobox
                            value={data.machine_template_id === '' ? '' : String(data.machine_template_id)}
                            onValueChange={(value) => applyTemplate(Number(value))}
                            options={templateOptions}
                            placeholder="Select template"
                            searchPlaceholder="Search templates..."
                            emptyLabel="No template found."
                        />
                        <InputError message={errors.machine_template_id} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            value={data.title}
                            onChange={(event) => setData('title', event.target.value)}
                            placeholder="Proforma title (optional)"
                        />
                        <InputError message={errors.title} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="issue_date">Issue Date</Label>
                        <Input
                            id="issue_date"
                            type="date"
                            value={data.issue_date}
                            onChange={(event) => setData('issue_date', event.target.value)}
                        />
                        <InputError message={errors.issue_date} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="due_date">Due Date (days)</Label>
                        <Input
                            id="due_date"
                            type="number"
                            min="1"
                            value={data.due_date}
                            onChange={(event) =>
                                setData(
                                    'due_date',
                                    event.target.value === '' ? '' : Number(event.target.value)
                                )
                            }
                            placeholder="e.g. 10"
                        />
                        <InputError message={errors.due_date} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="delivery_location">Delivery Location</Label>
                        <Input
                            id="delivery_location"
                            value={data.delivery_location}
                            onChange={(event) => setData('delivery_location', event.target.value)}
                        />
                        <InputError message={errors.delivery_location} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="delivery_time">Delivery Time</Label>
                        <Input
                            id="delivery_time"
                            value={data.delivery_time}
                            onChange={(event) => setData('delivery_time', event.target.value)}
                            placeholder="Immediately after payment"
                        />
                        <InputError message={errors.delivery_time} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Currency</Label>
                        <Select
                            value={data.currency}
                            onValueChange={(value: ProformaCurrency) => setData('currency', value)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="RSD">RSD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="HUF">HUF</SelectItem>
                            </SelectContent>
                        </Select>
                        <InputError message={errors.currency} />
                    </div>
                </div>

                {data.currency !== 'EUR' && (
                    <div className="grid gap-2">
                        <Label htmlFor="exchange_rate">
                            Exchange Rate (1 EUR = X {data.currency})
                        </Label>
                        <Input
                            id="exchange_rate"
                            type="number"
                            min="0"
                            step="0.000001"
                            value={data.exchange_rate}
                            onChange={(event) =>
                                setData(
                                    'exchange_rate',
                                    event.target.value === '' ? '' : Number(event.target.value)
                                )
                            }
                        />
                        <InputError message={errors.exchange_rate} />
                    </div>
                )}
            </section>

            <section className="space-y-4 rounded-lg border p-4">
                <h2 className="text-lg font-semibold">Machine Details</h2>

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <Label>Spec Fields</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setData('spec_fields', [...data.spec_fields, { key: '', value: '' }])
                            }
                        >
                            <Plus className="h-4 w-4" />
                            Add Spec
                        </Button>
                    </div>
                    {data.spec_fields.map((field, index) => (
                        <div key={`spec-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                            <div className="grid gap-1">
                                <Input
                                    value={field.key}
                                    onChange={(event) => {
                                        const next = [...data.spec_fields];
                                        next[index] = { ...next[index], key: event.target.value };
                                        setData('spec_fields', next);
                                    }}
                                    placeholder="Specification key"
                                />
                                <InputError message={errors[`spec_fields.${index}.key`]} />
                            </div>
                            <div className="grid gap-1">
                                <Input
                                    value={field.value}
                                    onChange={(event) => {
                                        const next = [...data.spec_fields];
                                        next[index] = { ...next[index], value: event.target.value };
                                        setData('spec_fields', next);
                                    }}
                                    placeholder="Specification value"
                                />
                                <InputError message={errors[`spec_fields.${index}.value`]} />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 self-start"
                                onClick={() =>
                                    setData(
                                        'spec_fields',
                                        data.spec_fields.filter((_, itemIndex) => itemIndex !== index)
                                    )
                                }
                            >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove spec field</span>
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <Label>Included Features</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setData('included_features', [...data.included_features, ''])}
                        >
                            <Plus className="h-4 w-4" />
                            Add Feature
                        </Button>
                    </div>
                    {data.included_features.map((feature, index) => (
                        <div key={`feature-${index}`} className="grid gap-2 md:grid-cols-[1fr_auto]">
                            <div className="grid gap-1">
                                <Input
                                    value={feature}
                                    onChange={(event) => {
                                        const next = [...data.included_features];
                                        next[index] = event.target.value;
                                        setData('included_features', next);
                                    }}
                                    placeholder="Included feature"
                                />
                                <InputError message={errors[`included_features.${index}`]} />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 self-start"
                                onClick={() =>
                                    setData(
                                        'included_features',
                                        data.included_features.filter(
                                            (_, itemIndex) => itemIndex !== index
                                        )
                                    )
                                }
                            >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove feature</span>
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="space-y-2">
                    <Label>Optional Extras (from template)</Label>
                    {data.optional_extras.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                            {data.optional_extras.map((extra, index) => (
                                <li key={`${extra}-${index}`}>{extra}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            No optional extras loaded.
                        </p>
                    )}
                </div>
            </section>

            <section className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">Line Items</h2>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            setData('items', [
                                ...data.items,
                                {
                                    description: '',
                                    chassis_number: '',
                                    quantity: 1,
                                    unit_price: 0,
                                    tax_rate: 20,
                                    total: 0,
                                },
                            ])
                        }
                    >
                        <Plus className="h-4 w-4" />
                        Add Item
                    </Button>
                </div>

                <div className="space-y-4">
                    {data.items.map((item, index) => (
                        <div key={`item-${index}`} className="grid gap-2 rounded-md border p-3">
                            <div className={cn('grid gap-2', index === 0 ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
                                <div className="grid gap-1">
                                    <Label>Description</Label>
                                    <Input
                                        value={item.description}
                                        onChange={(event) => {
                                            const next = [...data.items];
                                            next[index] = { ...next[index], description: event.target.value };
                                            setData('items', next);
                                        }}
                                    />
                                    <InputError message={errors[`items.${index}.description`]} />
                                </div>
                                {index === 0 && (
                                    <div className="grid gap-1">
                                        <Label>Chassis Number</Label>
                                        <Input
                                            value={item.chassis_number}
                                            onChange={(event) => {
                                                const next = [...data.items];
                                                next[index] = { ...next[index], chassis_number: event.target.value };
                                                setData('items', next);
                                            }}
                                            placeholder="Available after payment confirmation"
                                        />
                                        <InputError message={errors[`items.${index}.chassis_number`]} />
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                                <div className="grid gap-1">
                                    <Label>Quantity</Label>
                                    <Input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={item.quantity}
                                        onChange={(event) => {
                                            const next = [...data.items];
                                            next[index] = {
                                                ...next[index],
                                                quantity:
                                                    event.target.value === ''
                                                        ? ''
                                                        : Number(event.target.value),
                                            };
                                            setData('items', next);
                                        }}
                                    />
                                    <InputError message={errors[`items.${index}.quantity`]} />
                                </div>
                                <div className="grid gap-1">
                                    <Label>Unit Price ({currencySymbol(data.currency)})</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.unit_price}
                                        onChange={(event) => {
                                            const next = [...data.items];
                                            next[index] = {
                                                ...next[index],
                                                unit_price:
                                                    event.target.value === ''
                                                        ? ''
                                                        : Number(event.target.value),
                                            };
                                            setData('items', next);
                                        }}
                                    />
                                    <InputError message={errors[`items.${index}.unit_price`]} />
                                </div>
                                <div className="grid gap-1">
                                    <Label>Tax Rate %</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={item.tax_rate}
                                        onChange={(event) => {
                                            const next = [...data.items];
                                            next[index] = {
                                                ...next[index],
                                                tax_rate:
                                                    event.target.value === ''
                                                        ? ''
                                                        : Number(event.target.value),
                                            };
                                            setData('items', next);
                                        }}
                                    />
                                    <InputError message={errors[`items.${index}.tax_rate`]} />
                                </div>
                                <div className="grid gap-1">
                                    <Label>Row Total</Label>
                                    <Input
                                        readOnly
                                        value={calculateRowTotal(item.quantity, item.unit_price).toFixed(2)}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="mt-6 h-9 w-9"
                                    disabled={data.items.length <= 1}
                                    onClick={() =>
                                        setData(
                                            'items',
                                            data.items.filter((_, itemIndex) => itemIndex !== index)
                                        )
                                    }
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Remove item</span>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-2 rounded-lg border p-4">
                <h2 className="text-lg font-semibold">Totals</h2>
                <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">
                            {subtotal.toFixed(2)} {currencySymbol(data.currency)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tax Amount</span>
                        <span className="font-medium">
                            {taxAmount.toFixed(2)} {currencySymbol(data.currency)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                        <span className="font-semibold">Total</span>
                        <span className="font-semibold">
                            {total.toFixed(2)} {currencySymbol(data.currency)}
                        </span>
                    </div>
                </div>
            </section>

            <section className="space-y-2 rounded-lg border p-4">
                <h2 className="text-lg font-semibold">Notes</h2>
                <Textarea
                    value={data.notes}
                    onChange={(event) => setData('notes', event.target.value)}
                    rows={4}
                />
                <InputError message={errors.notes} />
            </section>

            <div className="flex items-center gap-2">
                <Button type="submit" disabled={processing}>
                    {submitLabel}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}
