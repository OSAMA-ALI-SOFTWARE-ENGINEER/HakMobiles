<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncChange extends Model
{
    public $timestamps = false;

    protected $primaryKey = 'seq';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['changed_at' => 'datetime'];
    }
}
