<?php

namespace App\Models;

class Expense extends BusinessModel
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
