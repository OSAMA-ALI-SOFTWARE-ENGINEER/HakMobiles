<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;

class BrandController extends Controller
{
    public function show(): JsonResponse
    {
        $settings = Setting::query()->whereIn('key', ['company_name', 'document_design'])->get()->keyBy('key');
        $design = $this->document($settings->get('document_design')?->value);
        $logo = is_string($design['logo'] ?? null) && str_starts_with($design['logo'], 'data:image/') ? $design['logo'] : '';
        $color = is_string($design['color'] ?? null) ? $design['color'] : 'indigo';
        $allowed = ['indigo', 'teal', 'navy', 'green', 'slate', 'wine'];

        return response()->json([
            'name' => $this->text($settings->get('company_name')?->value) ?: 'HAK Wholesales',
            'logo' => $logo,
            'color' => in_array($color, $allowed, true) ? $color : 'indigo',
        ]);
    }

    private function document(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);

            return is_array($decoded) ? $decoded : [];
        }

        return is_array($value) ? $value : [];
    }

    private function text(mixed $value): string
    {
        if (is_string($value)) {
            return trim($value);
        }
        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        return '';
    }
}
