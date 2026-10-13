<?php

namespace App\Support;

class AccessMatrix
{
    public const PERMISSIONS = [
        'dashboard.view',
        'dashboard.view_profit',
        'products.view',
        'products.manage',
        'products.view_cost',
        'stock.adjust',
        'purchases.view',
        'purchases.manage',
        'sales.create',
        'sales.manage',
        'sales.edit_own',
        'payments.view',
        'payments.manage',
        'customers.view',
        'customers.manage',
        'suppliers.view',
        'suppliers.manage',
        'expenses.view',
        'expenses.manage',
        'transfers.view',
        'transfers.manage',
        'reports.view',
        'activity.view',
        'settings.manage',
        'users.manage',
    ];

    public const ROLES = [
        'Super Admin' => self::PERMISSIONS,
        'Partner' => [
            'dashboard.view', 'dashboard.view_profit',
            'products.view', 'products.manage', 'products.view_cost',
            'stock.adjust',
            'purchases.view', 'purchases.manage',
            'sales.create', 'sales.manage',
            'payments.view', 'payments.manage',
            'customers.view', 'customers.manage',
            'suppliers.view', 'suppliers.manage',
            'expenses.view', 'expenses.manage',
            'transfers.view', 'transfers.manage',
            'reports.view', 'activity.view',
        ],
        'Manager' => [
            'dashboard.view',
            'products.view', 'products.manage',
            'stock.adjust',
            'purchases.view', 'purchases.manage',
            'sales.create', 'sales.manage',
            'payments.view', 'payments.manage',
            'customers.view', 'customers.manage',
            'suppliers.view', 'suppliers.manage',
            'expenses.view', 'expenses.manage',
            'reports.view',
        ],
        'Salesperson' => [
            'dashboard.view',
            'products.view',
            'sales.create', 'sales.edit_own',
            'payments.view', 'payments.manage',
            'customers.view', 'customers.manage',
        ],
        'Viewer' => [
            'dashboard.view', 'dashboard.view_profit',
            'products.view', 'products.view_cost',
            'purchases.view',
            'payments.view',
            'customers.view',
            'suppliers.view',
            'expenses.view',
            'transfers.view',
            'reports.view',
        ],
    ];

    /**
     * Tables the sync engine accepts. View and write are permission lists (any match).
     *
     * @var array<string, array{view: list<string>, write: list<string>}>
     */
    public const SYNC_TABLES = [
        'partners' => ['view' => ['dashboard.view_profit', 'transfers.view', 'transfers.manage', 'settings.manage'], 'write' => ['settings.manage']],
        'products' => ['view' => ['products.view'], 'write' => ['products.manage']],
        'customers' => ['view' => ['customers.view', 'customers.manage', 'sales.create', 'payments.manage'], 'write' => ['customers.manage']],
        'suppliers' => ['view' => ['suppliers.view', 'suppliers.manage'], 'write' => ['suppliers.manage']],
        'purchases' => ['view' => ['purchases.view', 'purchases.manage'], 'write' => ['purchases.manage']],
        'purchase_lines' => ['view' => ['purchases.view', 'purchases.manage'], 'write' => ['purchases.manage']],
        'sales' => ['view' => ['dashboard.view', 'sales.create', 'sales.manage'], 'write' => ['sales.create', 'sales.manage', 'sales.edit_own']],
        'sale_lines' => ['view' => ['dashboard.view', 'sales.create', 'sales.manage'], 'write' => ['sales.create', 'sales.manage', 'sales.edit_own']],
        'stock_adjustments' => ['view' => ['products.view', 'stock.adjust'], 'write' => ['stock.adjust']],
        'supplier_payments' => ['view' => ['purchases.view', 'purchases.manage'], 'write' => ['purchases.manage']],
        'customer_payments' => ['view' => ['payments.view', 'payments.manage'], 'write' => ['payments.manage']],
        'payment_allocations' => ['view' => ['payments.view', 'payments.manage'], 'write' => ['payments.manage']],
        'expenses' => ['view' => ['expenses.view', 'expenses.manage'], 'write' => ['expenses.manage']],
        'partner_transfers' => ['view' => ['transfers.view', 'transfers.manage'], 'write' => ['transfers.manage']],
        'settings' => ['view' => ['dashboard.view'], 'write' => ['settings.manage']],
        'customer_activities' => ['view' => ['customers.view', 'customers.manage'], 'write' => ['customers.manage']],
        'follow_ups' => ['view' => ['customers.view', 'customers.manage'], 'write' => ['customers.manage']],
    ];

    public const COST_FIELDS = ['unit_cost', 'unit_cost_at_sale'];

    public const TWO_FACTOR_ROLES = ['Super Admin', 'Partner'];
}
