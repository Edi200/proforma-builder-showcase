import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy, Download, FileText, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    create,
    destroy,
    duplicate,
    edit,
    index,
    pdf,
    preview,
} from '@/routes/proformas';
import type { Proforma, ProformaStatus, SendProformaFormData } from '@/types';

type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type PaginatedProformas = {
    data: Proforma[];
    current_page: number;
    last_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    from: number | null;
    to: number | null;
    total: number;
    links: PaginationLink[];
};

type ProformasIndexProps = {
    proformas: PaginatedProformas;
    search: string;
};

function formatIssueDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString();
}

function getCurrencySymbol(currency: Proforma['currency']): string {
    if (currency === 'EUR') {
        return 'EUR';
    }

    if (currency === 'HUF') {
        return 'Ft';
    }

    return 'RSD';
}

function formatMoney(value: string | number | null, currency: Proforma['currency']): string {
    if (value === null || value === '') {
        return '-';
    }

    const numeric = typeof value === 'number' ? value : Number.parseFloat(value);

    if (Number.isNaN(numeric)) {
        return '-';
    }

    return `${numeric.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} ${getCurrencySymbol(currency)}`;
}

function statusLabel(status: ProformaStatus): string {
    if (status === 'draft') {
        return 'Draft';
    }

    if (status === 'sent') {
        return 'Sent';
    }

    if (status === 'accepted') {
        return 'Accepted';
    }

    return 'Cancelled';
}

function statusVariant(status: ProformaStatus): 'secondary' | 'default' | 'outline' | 'destructive' {
    if (status === 'draft') {
        return 'secondary';
    }

    if (status === 'sent') {
        return 'default';
    }

    if (status === 'accepted') {
        return 'outline';
    }

    return 'destructive';
}

function statusClassName(status: ProformaStatus): string {
    if (status === 'draft') {
        return 'bg-slate-100 text-slate-800 hover:bg-slate-200';
    }

    if (status === 'sent') {
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    }

    if (status === 'accepted') {
        return 'bg-green-100 text-green-800 hover:bg-green-200';
    }

    return 'bg-red-100 text-red-800 hover:bg-red-200';
}

function DeleteProformaAction({ proforma }: { proforma: Proforma }) {
    const [open, setOpen] = useState(false);

    const confirmDelete = () => {
        router.delete(destroy.url(proforma.id), {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete proforma</span>
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete proforma?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will soft delete <strong>{proforma.number}</strong>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete}>
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function SendProformaAction({ proforma }: { proforma: Proforma }) {
    const [open, setOpen] = useState(false);
    const initialRecipient = proforma.client?.email ?? '';
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm<SendProformaFormData>({
        to: [initialRecipient],
        subject: `Proforma Invoice ${proforma.number}`,
        message: '',
    });

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);

        if (!nextOpen) {
            reset();
            clearErrors();
            setData({
                to: [initialRecipient],
                subject: `Proforma Invoice ${proforma.number}`,
                message: '',
            });
        }
    };

    const updateRecipient = (index: number, value: string) => {
        setData(
            'to',
            data.to.map((email, currentIndex) => (currentIndex === index ? value : email))
        );
    };

    const addRecipient = () => {
        setData('to', [...data.to, '']);
    };

    const removeRecipient = (index: number) => {
        if (data.to.length === 1) {
            return;
        }

        setData(
            'to',
            data.to.filter((_, currentIndex) => currentIndex !== index)
        );
    };

    const submit = () => {
        post(`/proformas/${proforma.id}/send`, {
            preserveScroll: true,
            onSuccess: () => handleOpenChange(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Mail className="h-4 w-4" />
                    <span className="sr-only">Send proforma</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Send proforma</DialogTitle>
                    <DialogDescription>
                        Send <strong>{proforma.number}</strong> by email with PDF attachment.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-sm font-medium">To</p>
                        <div className="space-y-2">
                            {data.to.map((email, index) => (
                                <div key={`recipient-${index}`} className="flex items-start gap-2">
                                    <div className="w-full space-y-1">
                                        <Input
                                            type="email"
                                            value={email}
                                            onChange={(event) => updateRecipient(index, event.target.value)}
                                            placeholder="recipient@example.com"
                                        />
                                        {errors[`to.${index}` as keyof typeof errors] ? (
                                            <p className="text-sm text-red-600">
                                                {errors[`to.${index}` as keyof typeof errors]}
                                            </p>
                                        ) : null}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => removeRecipient(index)}
                                        disabled={data.to.length === 1}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ))}
                        </div>
                        {errors.to ? <p className="text-sm text-red-600">{errors.to}</p> : null}
                        <Button type="button" variant="outline" onClick={addRecipient}>
                            Add recipient
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Subject</p>
                        <Input
                            value={data.subject}
                            onChange={(event) => setData('subject', event.target.value)}
                            placeholder={`Proforma Invoice ${proforma.number}`}
                        />
                        {errors.subject ? <p className="text-sm text-red-600">{errors.subject}</p> : null}
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Message (optional)</p>
                        <Textarea
                            value={data.message}
                            onChange={(event) => setData('message', event.target.value)}
                            placeholder="Add a personal note..."
                            rows={5}
                        />
                        {errors.message ? <p className="text-sm text-red-600">{errors.message}</p> : null}
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={submit} disabled={processing}>
                        {processing ? 'Sending...' : 'Send'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function ProformasIndex({ proformas, search }: ProformasIndexProps) {
    const [searchTerm, setSearchTerm] = useState(search);

    const openPreview = useCallback((proformaId: number) => {
        window.open(preview.url(proformaId), '_blank', 'noopener,noreferrer');
    }, []);

    const downloadPdf = useCallback((proformaId: number) => {
        window.location.assign(pdf.url(proformaId));
    }, []);

    const duplicateProforma = useCallback((proformaId: number) => {
        router.post(duplicate.url(proformaId), undefined, {
            preserveScroll: true,
        });
    }, []);

    const patchStatus = useCallback((proformaId: number, status: ProformaStatus) => {
        router.patch(
            `/proformas/${proformaId}/status`,
            { status },
            {
                preserveScroll: true,
            },
        );
    }, []);

    const columns = useMemo<ColumnDef<Proforma>[]>(
        () => [
            {
                accessorKey: 'number',
                header: 'Number',
            },
            {
                id: 'client',
                header: 'Client',
                meta: { className: 'hidden sm:table-cell' },
                cell: ({ row }) => row.original.client?.name ?? '-',
            },
            {
                accessorKey: 'issue_date',
                header: 'Issue Date',
                meta: { className: 'hidden sm:table-cell' },
                cell: ({ row }) => formatIssueDate(row.original.issue_date),
            },
            {
                accessorKey: 'total',
                header: 'Total',
                meta: { className: 'hidden sm:table-cell' },
                cell: ({ row }) => formatMoney(row.original.total, row.original.currency),
            },
            {
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                            <Button
                                type="button"
                                variant="ghost"
                                className={`h-7 rounded-full px-3 text-xs font-medium ${statusClassName(row.original.status)}`}
                            >
                                {statusLabel(row.original.status)}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
                            {(['draft', 'sent', 'accepted', 'cancelled'] as const).map((status) => (
                                <DropdownMenuItem
                                    key={status}
                                    onClick={() => patchStatus(row.original.id, status)}
                                >
                                    <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
            },
            {
                id: 'actions',
                header: 'Actions',
                cell: ({ row }) => (
                    <div
                        className="flex items-center gap-1"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(event) => {
                                event.stopPropagation();
                                openPreview(row.original.id);
                            }}
                        >
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">Preview proforma PDF</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(event) => {
                                event.stopPropagation();
                                downloadPdf(row.original.id);
                            }}
                        >
                            <Download className="h-4 w-4" />
                            <span className="sr-only">Download proforma PDF</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(event) => {
                                event.stopPropagation();
                                duplicateProforma(row.original.id);
                            }}
                        >
                            <Copy className="h-4 w-4" />
                            <span className="sr-only">Copy proforma</span>
                        </Button>
                        <SendProformaAction proforma={row.original} />
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link
                                href={edit(row.original.id)}
                                onClick={(event) => event.stopPropagation()}
                            >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit proforma</span>
                            </Link>
                        </Button>
                        <DeleteProformaAction proforma={row.original} />
                    </div>
                ),
            },
        ],
        [downloadPdf, duplicateProforma, openPreview, patchStatus]
    );

    const table = useReactTable({
        data: proformas.data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const visitUrl = (url: string | null) => {
        if (!url) {
            return;
        }

        router.visit(url, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const numberedPageLinks = proformas.links.filter(
        (link) => link.label !== '&laquo; Previous' && link.label !== 'Next &raquo;'
    );

    const mobilePageLinks = numberedPageLinks.filter((link) => {
        const page = Number.parseInt(link.label, 10);

        if (Number.isNaN(page)) {
            return false;
        }

        return Math.abs(page - proformas.current_page) <= 1;
    });

    const desktopPageItems = useMemo(() => {
        const pages = new Set<number>([1, proformas.last_page]);

        for (let page = proformas.current_page - 2; page <= proformas.current_page + 2; page++) {
            if (page >= 1 && page <= proformas.last_page) {
                pages.add(page);
            }
        }

        const sortedPages = Array.from(pages).sort((a, b) => a - b);
        const items: Array<
            | { type: 'page'; page: number; active: boolean; url: string }
            | { type: 'ellipsis'; key: string }
        > = [];

        sortedPages.forEach((page, pageIndex) => {
            if (pageIndex > 0) {
                const previousPage = sortedPages[pageIndex - 1];

                if (page - previousPage > 1) {
                    items.push({
                        type: 'ellipsis',
                        key: `ellipsis-${previousPage}-${page}`,
                    });
                }
            }

            items.push({
                type: 'page',
                page,
                active: page === proformas.current_page,
                url: index({
                    query: {
                        page,
                        search: search || undefined,
                    },
                }).url,
            });
        });

        return items;
    }, [proformas.current_page, proformas.last_page, search]);

    useEffect(() => {
        setSearchTerm(search);
    }, [search]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchTerm === search) {
                return;
            }

            router.get(
                index(),
                { search: searchTerm || undefined },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                }
            );
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [search, searchTerm]);

    return (
        <>
            <Head title="Proformas" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold tracking-tight">Proformas</h1>
                    <Button asChild>
                        <Link href={create()}>
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">New Proforma</span>
                            <span className="sr-only sm:hidden">New Proforma</span>
                        </Link>
                    </Button>
                </div>

                <div className="max-w-sm">
                    <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search..."
                    />
                </div>

                <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id} className="border-b">
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className={`px-4 py-3 text-left font-medium ${((header.column.columnDef.meta as { className?: string } | undefined)?.className ?? '')}`}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef.header,
                                                      header.getContext()
                                                  )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.length > 0 ? (
                                table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="hover:bg-muted/30 cursor-pointer border-b last:border-b-0"
                                        onClick={() => openPreview(row.original.id)}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td
                                                key={cell.id}
                                                className={`px-4 py-3 align-middle ${((cell.column.columnDef.meta as { className?: string } | undefined)?.className ?? '')}`}
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={columns.length}
                                        className="text-muted-foreground px-4 py-8 text-center"
                                    >
                                        No proformas found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted-foreground text-sm">
                        {proformas.total > 0
                            ? `Showing ${proformas.from ?? 0}-${proformas.to ?? 0} of ${proformas.total} proformas`
                            : 'No results'}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!proformas.prev_page_url}
                            onClick={() => visitUrl(proformas.prev_page_url)}
                        >
                            Previous
                        </Button>

                        {desktopPageItems.map((item) =>
                            item.type === 'ellipsis' ? (
                                <span
                                    key={item.key}
                                    className="text-muted-foreground hidden px-1 text-sm sm:inline"
                                >
                                    ...
                                </span>
                            ) : (
                                <Button
                                    key={item.page}
                                    variant={item.active ? 'default' : 'outline'}
                                    size="sm"
                                    className="hidden sm:inline-flex"
                                    onClick={() => visitUrl(item.url)}
                                >
                                    {item.page}
                                </Button>
                            )
                        )}

                        {mobilePageLinks.map((link) => (
                            <Button
                                key={link.label}
                                variant={link.active ? 'default' : 'outline'}
                                size="sm"
                                className="sm:hidden"
                                disabled={!link.url}
                                onClick={() => visitUrl(link.url)}
                            >
                                {link.label}
                            </Button>
                        ))}

                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!proformas.next_page_url}
                            onClick={() => visitUrl(proformas.next_page_url)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>

        </>
    );
}

ProformasIndex.layout = {
    breadcrumbs: [
        {
            title: 'Proformas',
            href: index(),
        },
    ],
};
