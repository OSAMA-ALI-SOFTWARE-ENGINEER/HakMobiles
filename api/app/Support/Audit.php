<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

class Audit
{
    public static function log(string $action, ?Model $subject = null, array $properties = []): void
    {
        $logger = activity()->withProperties(array_merge($properties, [
            'ip' => request()?->ip(),
        ]));

        if ($user = auth()->user()) {
            $logger->causedBy($user);
        }

        if ($subject) {
            $logger->performedOn($subject);
        }

        $logger->log($action);
    }
}
