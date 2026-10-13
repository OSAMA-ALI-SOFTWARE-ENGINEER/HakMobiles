<?php

namespace App\Models;

class PartnerTransfer extends BusinessModel
{
    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }
}
