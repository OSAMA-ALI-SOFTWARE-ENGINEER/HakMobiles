<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\PaymentAllocation;
use App\Models\Sale;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    public function duplicates(): JsonResponse
    {
        $customers = Customer::query()->get(['id', 'shop_name', 'nif', 'phone']);
        $groups = [];

        foreach (['nif', 'phone'] as $field) {
            $buckets = [];
            foreach ($customers as $customer) {
                $value = $customer->{$field};
                if ($value === null || $value === '') {
                    continue;
                }
                $buckets[$field.':'.$value][] = $customer;
            }
            foreach ($buckets as $key => $rows) {
                if (count($rows) > 1) {
                    $groups[] = ['match' => $key, 'customers' => $rows];
                }
            }
        }

        return response()->json(['data' => $groups]);
    }

    public function merge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'keep_id' => ['required', 'uuid', 'exists:customers,id'],
            'merge_id' => ['required', 'uuid', 'different:keep_id', 'exists:customers,id'],
        ]);

        $keep = Customer::query()->findOrFail($data['keep_id']);
        $merge = Customer::query()->findOrFail($data['merge_id']);

        DB::transaction(function () use ($keep, $merge) {
            Sale::query()->where('customer_id', $merge->id)->update(['customer_id' => $keep->id]);
            CustomerPayment::query()->where('customer_id', $merge->id)->update(['customer_id' => $keep->id]);
            PaymentAllocation::query()
                ->whereIn('sale_id', Sale::query()->where('customer_id', $keep->id)->pluck('id'))
                ->update(['updated_at' => now()]);
            $merge->delete();
        });

        Audit::log('customer.merged', $keep, ['merged_id' => $merge->id]);

        return response()->json(['kept' => $keep->id, 'merged' => $merge->id]);
    }
}
