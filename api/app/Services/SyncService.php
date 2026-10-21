<?php

namespace App\Services;

use App\Models\ProcessedOp;
use App\Models\SyncChange;
use App\Models\User;
use App\Support\AccessMatrix;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SyncService
{
    /** @var array<string, array<string, array<string, mixed>>> */
    private array $columnInfo = [];

    /**
     * @param  list<array{op_id: string, table: string, record_id: string, payload: array<string, mixed>}>  $ops
     * @return array{accepted: list<string>, rejected: list<array{op_id: string, reason: string}>}
     */
    public function push(User $user, array $ops, ?string $deviceId): array
    {
        $accepted = [];
        $rejected = [];
        $seen = [];

        DB::transaction(function () use ($user, $ops, $deviceId, &$accepted, &$rejected, &$seen) {
            foreach ($ops as $op) {
                $opId = (string) ($op['op_id'] ?? '');
                $table = (string) ($op['table'] ?? '');
                $recordId = (string) ($op['record_id'] ?? '');
                $payload = $op['payload'] ?? [];

                if ($opId === '' || isset($seen[$opId])) {
                    $rejected[] = ['op_id' => $opId, 'reason' => 'invalid'];

                    continue;
                }
                $seen[$opId] = true;

                if (ProcessedOp::query()->where('op_id', $opId)->exists()) {
                    $accepted[] = $opId;

                    continue;
                }

                if (! isset(AccessMatrix::SYNC_TABLES[$table]) || ! is_array($payload) || ! Str::isUuid($recordId)) {
                    $rejected[] = ['op_id' => $opId, 'reason' => 'invalid'];

                    continue;
                }

                if (! $this->allows($user, AccessMatrix::SYNC_TABLES[$table]['write'])) {
                    $rejected[] = ['op_id' => $opId, 'reason' => 'forbidden'];

                    continue;
                }

                if (! $this->allowsOwnSaleEdit($user, $table, $payload)) {
                    $rejected[] = ['op_id' => $opId, 'reason' => 'forbidden'];

                    continue;
                }

                try {
                    DB::transaction(function () use ($table, $recordId, $payload, $user, $deviceId) {
                        $this->upsert($table, $recordId, $payload, $user, $deviceId);
                        SyncChange::query()->create([
                            'table_name' => $table,
                            'record_id' => $recordId,
                            'changed_at' => now(),
                        ]);
                    });
                } catch (\Throwable $exception) {
                    $rejected[] = ['op_id' => $opId, 'reason' => 'invalid: '.\Illuminate\Support\Str::limit($exception->getMessage(), 160, '')];

                    continue;
                }

                ProcessedOp::query()->create([
                    'op_id' => $opId,
                    'device_id' => $deviceId,
                    'processed_at' => now(),
                ]);
                $accepted[] = $opId;
            }
        });

        return ['accepted' => array_values($accepted), 'rejected' => $rejected];
    }

    /**
     * @return array{changes: list<array<string, mixed>>, last_seq: int, permissions: list<string>, colleagues: list<array<string, mixed>>}
     */
    public function pull(User $user, int $since): array
    {
        $rows = SyncChange::query()
            ->where('seq', '>', $since)
            ->orderBy('seq')
            ->limit(500)
            ->get();

        $changes = [];
        $last = $since;

        foreach ($rows as $change) {
            $last = (int) $change->seq;
            $presented = $this->present($user, $change->table_name, $change->record_id);
            if ($presented === null) {
                continue;
            }
            $changes[] = [
                'seq' => $last,
                'table' => $change->table_name,
                'record_id' => $change->record_id,
                'data' => $presented,
            ];
        }

        return [
            'changes' => $changes,
            'last_seq' => $last,
            'more' => $rows->count() === 500,
            'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
            'colleagues' => User::query()->get(['id', 'name', 'is_active'])->toArray(),
        ];
    }

    /**
     * Archive every current business row and store the tracker sample.
     * A soft-deleted product, supplier, sale, or customer gives up its unique value.
     *
     * @param  array<string, list<array<string, mixed>>>  $tables
     */
    public function installSample(User $user, array $tables): void
    {
        DB::transaction(function () use ($user, $tables) {
            foreach ($tables as $table => $rows) {
                if (! isset(AccessMatrix::SYNC_TABLES[$table]) || ! is_array($rows)) {
                    continue;
                }
                $keep = [];
                foreach ($rows as $row) {
                    if (is_array($row) && isset($row['id'])) {
                        $keep[(string) $row['id']] = true;
                    }
                }
                $existing = DB::table($table)->whereNull('deleted_at')->pluck('id');
                foreach ($existing as $id) {
                    if (isset($keep[(string) $id])) {
                        continue;
                    }
                    $this->retireRow($table, (string) $id);
                    SyncChange::query()->create([
                        'table_name' => $table,
                        'record_id' => (string) $id,
                        'changed_at' => now(),
                    ]);
                }
                foreach ($rows as $row) {
                    if (! is_array($row) || ! isset($row['id']) || ! Str::isUuid((string) $row['id'])) {
                        continue;
                    }
                    $this->upsert($table, (string) $row['id'], $row, $user, null);
                    SyncChange::query()->create([
                        'table_name' => $table,
                        'record_id' => (string) $row['id'],
                        'changed_at' => now(),
                    ]);
                }
            }
        });
    }

    private function retireRow(string $table, string $id): void
    {
        $current = DB::table($table)->where('id', $id)->first();
        if (! $current) {
            return;
        }
        $row = (array) $current;
        $update = [
            'deleted_at' => now()->toDateTimeString(),
            'updated_at' => now()->toDateTimeString(),
        ];
        $unique = [
            'products' => 'code',
            'suppliers' => 'name',
            'sales' => 'invoice_no',
        ];
        if (isset($unique[$table], $row[$unique[$table]]) && $row[$unique[$table]] !== '') {
            $update[$unique[$table]] = $row[$unique[$table]].'~'.substr($id, 0, 8);
        }
        if ($table === 'customers' && ! empty($row['nif'])) {
            $update['nif'] = null;
        }
        DB::table($table)->where('id', $id)->update($update);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function upsert(string $table, string $recordId, array $payload, User $user, ?string $deviceId): void
    {
        $columns = Schema::getColumnListing($table);
        $payload['id'] = $recordId;
        $payload['updated_by'] = $payload['updated_by'] ?? $user->id;
        $payload['device_id'] = $deviceId ?: ($payload['device_id'] ?? null);
        $payload['updated_at'] = $payload['updated_at'] ?? now()->toDateTimeString();
        $payload['created_at'] = $payload['created_at'] ?? now()->toDateTimeString();

        foreach ($payload as $key => $value) {
            if (is_array($value)) {
                $payload[$key] = json_encode($value);
            } elseif (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}T/', $value)) {
                try {
                    $payload[$key] = \Carbon\Carbon::parse($value)->utc()->format('Y-m-d H:i:s');
                } catch (\Throwable) {
                    $payload[$key] = $value;
                }
            }
        }

        $row = $this->applyColumnDefaults($table, array_intersect_key($payload, array_flip($columns)));
        $this->releaseArchivedUniques($table, $row);
        $existing = DB::table($table)->where('id', $recordId)->first();

        if ($existing && isset($existing->updated_at, $row['updated_at']) && (string) $row['updated_at'] < (string) $existing->updated_at) {
            Audit::log('sync.older_edit_kept', null, [
                'table' => $table,
                'record_id' => $recordId,
                'ignored' => $row,
            ]);

            return;
        }

        $update = $row;
        unset($update['id'], $update['created_at']);

        DB::table($table)->upsert([$row], ['id'], array_keys($update));

        if ($table === 'products' && $existing && array_key_exists('sell_price', $row) && abs((float) $existing->sell_price - (float) $row['sell_price']) >= 0.001) {
            Audit::log('product.price_changed', null, [
                'record_id' => $recordId,
                'old' => $existing->sell_price,
                'new' => $row['sell_price'],
                'device_id' => $deviceId,
            ]);
        }
    }

    /**
     * MySQL rejects an explicit NULL on a NOT NULL column even when that column has a default.
     * An empty shipping cost, price, or amount is zero. Nullable columns such as credit limit stay empty.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function applyColumnDefaults(string $table, array $row): array
    {
        if (! isset($this->columnInfo[$table])) {
            $info = [];
            foreach (Schema::getColumns($table) as $column) {
                $info[$column['name']] = $column;
            }
            $this->columnInfo[$table] = $info;
        }

        foreach ($row as $key => $value) {
            if ($value !== null) {
                continue;
            }
            $column = $this->columnInfo[$table][$key] ?? null;
            if ($column === null || $column['nullable'] || $column['default'] === null || $column['default'] === '') {
                continue;
            }
            $default = $column['default'];
            if (is_string($default) && preg_match('/current_timestamp|now\(/i', $default)) {
                continue;
            }
            if (is_string($default) && preg_match("/^'(.*)'$/", $default, $match)) {
                $default = $match[1];
            }
            $row[$key] = $default;
        }

        return $row;
    }

    /**
     * A soft-deleted row must not keep a product code, supplier name, invoice number, or NIF.
     *
     * @param  array<string, mixed>  $row
     */
    private function releaseArchivedUniques(string $table, array $row): void
    {
        $columns = [
            'products' => 'code',
            'suppliers' => 'name',
            'sales' => 'invoice_no',
            'customers' => 'nif',
        ];
        $column = $columns[$table] ?? null;
        if ($column === null || ! isset($row[$column]) || $row[$column] === null || $row[$column] === '') {
            return;
        }

        $conflicts = DB::table($table)
            ->where($column, $row[$column])
            ->where('id', '!=', $row['id'])
            ->whereNotNull('deleted_at')
            ->pluck('id');

        foreach ($conflicts as $id) {
            DB::table($table)->where('id', $id)->update([
                $column => $row[$column].'~'.substr((string) $id, 0, 8),
            ]);
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function present(User $user, string $table, string $recordId): ?array
    {
        if (! isset(AccessMatrix::SYNC_TABLES[$table])) {
            return null;
        }

        if (! $this->allows($user, AccessMatrix::SYNC_TABLES[$table]['view'])) {
            return null;
        }

        $record = DB::table($table)->where('id', $recordId)->first();
        if (! $record) {
            return null;
        }

        $data = (array) $record;
        if (! $this->allows($user, ['products.view_cost'])) {
            foreach (AccessMatrix::COST_FIELDS as $field) {
                unset($data[$field]);
            }
        }

        return $data;
    }

    /**
     * @param  list<string>  $permissions
     */
    private function allows(User $user, array $permissions): bool
    {
        if ($user->hasRole('Super Admin')) {
            return true;
        }

        foreach ($permissions as $permission) {
            if ($user->can($permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function allowsOwnSaleEdit(User $user, string $table, array $payload): bool
    {
        if (! in_array($table, ['sales', 'sale_lines'], true)) {
            return true;
        }

        if ($user->hasRole('Super Admin') || $user->can('sales.manage')) {
            return true;
        }

        $saleId = $table === 'sales' ? ($payload['id'] ?? null) : ($payload['sale_id'] ?? null);
        $existing = $saleId ? DB::table('sales')->where('id', $saleId)->first() : null;

        if (! $existing) {
            return $user->can('sales.create');
        }

        if (! $user->can('sales.edit_own')) {
            return false;
        }

        $today = now()->timezone('Europe/Lisbon')->toDateString();
        $soldBy = $payload['sold_by'] ?? $existing->sold_by;

        return $existing->sold_by === $user->id
            && substr((string) $existing->date, 0, 10) === $today
            && $soldBy === $user->id;
    }
}
