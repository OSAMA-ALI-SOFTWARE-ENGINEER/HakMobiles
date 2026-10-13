<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends BusinessModel
{
    /** @use HasFactory<\Database\Factories\CustomerFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['credit_limit' => 'decimal:2'];
    }

    protected function nif(): Attribute
    {
        return Attribute::make(
            set: fn ($value) => ($value === null || $value === '') ? null : $value,
        );
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(CustomerPayment::class);
    }
}
