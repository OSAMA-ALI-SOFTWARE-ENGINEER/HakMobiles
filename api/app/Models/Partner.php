<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Partner extends BusinessModel
{
    protected function casts(): array
    {
        return ['share_pct' => 'decimal:2'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
