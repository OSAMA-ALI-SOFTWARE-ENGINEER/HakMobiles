<?php

namespace App\Models;

class Setting extends BusinessModel
{
    protected function casts(): array
    {
        return ['value' => 'array'];
    }
}
