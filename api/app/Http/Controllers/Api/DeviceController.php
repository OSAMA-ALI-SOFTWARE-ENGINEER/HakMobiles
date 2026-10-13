<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Laravel\Sanctum\PersonalAccessToken;

class DeviceController extends Controller
{
    public function index(): JsonResponse
    {
        $devices = Device::query()->with('user:id,name,email')->orderByDesc('last_sync_at')->get();

        return response()->json(['data' => $devices]);
    }

    public function revoke(Device $device): JsonResponse
    {
        $device->forceFill(['revoked_at' => now()])->save();
        PersonalAccessToken::query()->where('device_id', $device->id)->delete();
        Audit::log('device.revoked', $device);

        return response()->json(['message' => 'Device revoked.']);
    }
}
