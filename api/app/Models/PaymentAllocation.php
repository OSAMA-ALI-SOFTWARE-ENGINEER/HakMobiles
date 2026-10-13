<?php

namespace App\Models;

class PaymentAllocation extends BusinessModel
{
    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }
}
