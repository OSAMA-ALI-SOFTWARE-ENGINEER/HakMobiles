<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    public function update(Request $request, Sale $sale): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('Super Admin') && ! $user->can('sales.manage')) {
            $today = now()->timezone('Europe/Lisbon')->toDateString();
            $saleDay = $sale->date?->toDateString();
            if ($sale->sold_by !== $user->id || $saleDay !== $today) {
                abort(403, 'You can only edit your own sales from today.');
            }
        }

        $data = $request->validate([
            'note' => ['nullable', 'string'],
            'date' => ['sometimes', 'date'],
        ]);
        $before = $sale->only(array_keys($data));
        $sale->fill($data);
        $sale->updated_by = $user->id;
        $sale->save();
        Audit::log('sale.updated', $sale, ['before' => $before, 'after' => $data]);

        return response()->json(['data' => $sale]);
    }
}
