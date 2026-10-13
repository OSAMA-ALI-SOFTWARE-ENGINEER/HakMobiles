<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\Expense;
use App\Models\Partner;
use App\Models\PartnerTransfer;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\SaleLine;
use App\Models\Setting;
use App\Models\StockAdjustment;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Support\AccessMatrix;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class RecordController extends Controller
{
    /** @var array<string, class-string<Model>> */
    private const MODELS = [
        'products' => Product::class,
        'customers' => Customer::class,
        'suppliers' => Supplier::class,
        'purchases' => Purchase::class,
        'sales' => Sale::class,
        'stock-adjustments' => StockAdjustment::class,
        'supplier-payments' => SupplierPayment::class,
        'customer-payments' => CustomerPayment::class,
        'expenses' => Expense::class,
        'partner-transfers' => PartnerTransfer::class,
        'partners' => Partner::class,
        'settings' => Setting::class,
    ];

    public function index(Request $request, string $resource): JsonResponse
    {
        $model = $this->model($resource);
        $query = $model::query()->latest()->limit(500);
        if (in_array($resource, ['sales', 'purchases'], true)) {
            $query->with('lines');
        }
        $rows = $query->get()->map(fn (Model $row) => $this->strip($request, $row));

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request, string $resource): JsonResponse
    {
        $model = $this->model($resource);
        $payload = $request->all();
        $lines = is_array($payload['lines'] ?? null) ? $payload['lines'] : null;
        unset($payload['lines']);
        $payload['id'] = $payload['id'] ?? (string) Str::uuid7();
        $payload['created_by'] = $payload['created_by'] ?? $request->user()->id;
        $payload['updated_by'] = $request->user()->id;
        $record = new $model;
        $columns = Schema::getColumnListing($record->getTable());
        $record->forceFill(array_intersect_key($payload, array_flip($columns)));
        $record->save();

        if ($resource === 'sales' && $lines) {
            foreach ($lines as $line) {
                SaleLine::query()->create([
                    'sale_id' => $record->id,
                    'product_id' => $line['product_id'],
                    'qty' => $line['qty'],
                    'unit_price' => $line['unit_price'],
                    'discount' => $line['discount'] ?? 0,
                    'unit_cost_at_sale' => $line['unit_cost_at_sale'] ?? null,
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);
            }
            $record->load('lines');
        }

        return response()->json(['data' => $this->strip($request, $record)], 201);
    }

    public function dashboard(): JsonResponse
    {
        return response()->json(['status' => 'ok']);
    }

    public function profit(): JsonResponse
    {
        return response()->json(['status' => 'ok']);
    }

    public function reports(): JsonResponse
    {
        return response()->json(['status' => 'ok']);
    }

    public function activity(): JsonResponse
    {
        $items = \Spatie\Activitylog\Models\Activity::query()->with('causer')->latest()->limit(200)->get()->map(fn ($item) => [
            'id' => $item->id,
            'description' => $item->description,
            'created_at' => $item->created_at,
            'causer' => $item->causer?->name,
            'properties' => $item->properties,
        ]);

        return response()->json(['data' => $items]);
    }

    /** @param  class-string<Model>  $model */
    private function model(string $resource): string
    {
        abort_unless(isset(self::MODELS[$resource]), 404);

        return self::MODELS[$resource];
    }

    private function strip(Request $request, Model $row): array
    {
        $data = $row->toArray();
        $user = $request->user();
        $hideCost = $user && ! $user->hasRole('Super Admin') && ! $user->can('products.view_cost');
        if ($hideCost) {
            foreach (AccessMatrix::COST_FIELDS as $field) {
                unset($data[$field]);
            }
            if (isset($data['lines']) && is_array($data['lines'])) {
                $data['lines'] = array_map(function (array $line) {
                    unset($line['unit_cost'], $line['unit_cost_at_sale']);

                    return $line;
                }, $data['lines']);
            }
        }

        return $data;
    }
}
