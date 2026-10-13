<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class Product extends BusinessModel
{
    /** @use HasFactory<\Database\Factories\ProductFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['sell_price' => 'decimal:2'];
    }
}
