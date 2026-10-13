<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProcessedOp extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $primaryKey = 'op_id';

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['processed_at' => 'datetime'];
    }
}
