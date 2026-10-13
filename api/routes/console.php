<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Schedule::command('backup:run --only-db')->dailyAt('02:00');
Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::call(function () {
    DB::table('sync_changes')->where('changed_at', '<', now()->subDays(90))->delete();
    DB::table('processed_ops')->where('processed_at', '<', now()->subDays(90))->delete();
})->daily()->name('prune-sync-log');
