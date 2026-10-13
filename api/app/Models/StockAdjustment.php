<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAdjustment extends BusinessModel
{
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
