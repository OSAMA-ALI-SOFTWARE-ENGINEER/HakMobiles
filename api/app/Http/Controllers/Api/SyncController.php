<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Services\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SyncController extends Controller
{
    public function push(Request $request, SyncService $sync): JsonResponse
    {
        $data = $request->validate([
            'ops' => ['present', 'array', 'max:200'],
            'ops.*.op_id' => ['required', 'uuid'],
            'ops.*.table' => ['required', 'string'],
            'ops.*.record_id' => ['required', 'uuid'],
            'ops.*.payload' => ['required', 'array'],
            'app_version' => ['nullable', 'string'],
        ]);

        $device = $this->touchDevice($request);
        $result = $sync->push($request->user(), $data['ops'], $device?->id);

        return response()->json($result);
    }

    public function sample(Request $request, SyncService $sync): JsonResponse
    {
        abort_unless($request->user()->hasRole('Super Admin'), 403);
        $data = $request->validate([
            'tables' => ['required', 'array'],
        ]);
        $sync->installSample($request->user(), $data['tables']);

        return response()->json(['status' => 'ok']);
    }

    public function pull(Request $request, SyncService $sync): JsonResponse
    {
        $since = (int) $request->query('since', 0);
        $this->touchDevice($request);

        return response()->json($sync->pull($request->user(), $since));
    }

    private function touchDevice(Request $request): ?Device
    {
        $token = $request->user()?->currentAccessToken();
        $deviceId = (is_object($token) && isset($token->device_id)) ? $token->device_id : null;
        $device = $deviceId ? Device::query()->find($deviceId) : null;

        if ($token instanceof \Laravel\Sanctum\PersonalAccessToken) {
            $token->forceFill(['expires_at' => now()->addDays(30)]);
            $token->save();
        }

        if ($device) {
            $device->forceFill([
                'last_sync_at' => now(),
                'app_version' => $request->input('app_version', $device->app_version),
            ])->save();
        }

        return $device;
    }
}
