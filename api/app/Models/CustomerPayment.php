<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerPayment extends BusinessModel
{
    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }
}
