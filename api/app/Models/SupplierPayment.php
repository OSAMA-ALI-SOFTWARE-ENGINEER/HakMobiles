<?php

namespace App\Models;

class SupplierPayment extends BusinessModel
{
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'fx_rate' => 'decimal:6',
            'amount_eur' => 'decimal:2',
        ];
    }
}
