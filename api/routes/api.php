<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\FileController;
use App\Http\Controllers\Api\RecordController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SyncController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'time' => now()->toIso8601String(),
    ]);
});

Route::post('/auth/login', [AuthController::class, 'login']);
Route::get('/brand', [BrandController::class, 'show']);

Route::middleware(['auth:sanctum', 'account.state'])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/two-factor/setup', [AuthController::class, 'setupTwoFactor']);
    Route::post('/auth/two-factor/confirm', [AuthController::class, 'confirmTwoFactor']);

    Route::get('/dashboard', [RecordController::class, 'dashboard'])->middleware('permission:dashboard.view');
    Route::get('/dashboard/profit', [RecordController::class, 'profit'])->middleware('permission:dashboard.view_profit');
    Route::get('/reports', [RecordController::class, 'reports'])->middleware('permission:reports.view');
    Route::get('/activity', [RecordController::class, 'activity'])->middleware('permission:activity.view');

    Route::get('/products', fn () => app(RecordController::class)->index(request(), 'products'))->middleware('permission:products.view');
    Route::post('/products', fn () => app(RecordController::class)->store(request(), 'products'))->middleware('permission:products.manage');
    Route::post('/stock-adjustments', fn () => app(RecordController::class)->store(request(), 'stock-adjustments'))->middleware('permission:stock.adjust');

    Route::get('/purchases', fn () => app(RecordController::class)->index(request(), 'purchases'))->middleware('permission:purchases.view|purchases.manage');
    Route::post('/purchases', fn () => app(RecordController::class)->store(request(), 'purchases'))->middleware('permission:purchases.manage');
    Route::get('/supplier-payments', fn () => app(RecordController::class)->index(request(), 'supplier-payments'))->middleware('permission:purchases.view|purchases.manage');
    Route::post('/supplier-payments', fn () => app(RecordController::class)->store(request(), 'supplier-payments'))->middleware('permission:purchases.manage');

    Route::get('/sales', fn () => app(RecordController::class)->index(request(), 'sales'))->middleware('permission:dashboard.view');
    Route::post('/sales', fn () => app(RecordController::class)->store(request(), 'sales'))->middleware('permission:sales.create|sales.manage');
    Route::patch('/sales/{sale}', [SaleController::class, 'update'])->middleware('permission:sales.manage|sales.edit_own');

    Route::get('/customer-payments', fn () => app(RecordController::class)->index(request(), 'customer-payments'))->middleware('permission:payments.view|payments.manage');
    Route::post('/customer-payments', fn () => app(RecordController::class)->store(request(), 'customer-payments'))->middleware('permission:payments.manage');

    Route::get('/customers', fn () => app(RecordController::class)->index(request(), 'customers'))->middleware('permission:customers.view|customers.manage');
    Route::post('/customers', fn () => app(RecordController::class)->store(request(), 'customers'))->middleware('permission:customers.manage');
    Route::get('/customers/duplicates', [CustomerController::class, 'duplicates'])->middleware('permission:users.manage');
    Route::post('/customers/merge', [CustomerController::class, 'merge'])->middleware('permission:users.manage');

    Route::get('/suppliers', fn () => app(RecordController::class)->index(request(), 'suppliers'))->middleware('permission:suppliers.view|suppliers.manage');
    Route::post('/suppliers', fn () => app(RecordController::class)->store(request(), 'suppliers'))->middleware('permission:suppliers.manage');

    Route::get('/expenses', fn () => app(RecordController::class)->index(request(), 'expenses'))->middleware('permission:expenses.view|expenses.manage');
    Route::post('/expenses', fn () => app(RecordController::class)->store(request(), 'expenses'))->middleware('permission:expenses.manage');

    Route::get('/partner-transfers', fn () => app(RecordController::class)->index(request(), 'partner-transfers'))->middleware('permission:transfers.view|transfers.manage');
    Route::post('/partner-transfers', fn () => app(RecordController::class)->store(request(), 'partner-transfers'))->middleware('permission:transfers.manage');

    Route::get('/partners', fn () => app(RecordController::class)->index(request(), 'partners'))->middleware('permission:dashboard.view_profit|settings.manage');
    Route::post('/partners', fn () => app(RecordController::class)->store(request(), 'partners'))->middleware('permission:settings.manage');
    Route::get('/settings', fn () => app(RecordController::class)->index(request(), 'settings'))->middleware('permission:settings.manage|dashboard.view');
    Route::post('/settings', fn () => app(RecordController::class)->store(request(), 'settings'))->middleware('permission:settings.manage');

    Route::get('/users', [UserController::class, 'index'])->middleware('permission:users.manage');
    Route::post('/users', [UserController::class, 'store'])->middleware('permission:users.manage');
    Route::patch('/users/{user}', [UserController::class, 'update'])->middleware('permission:users.manage');
    Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->middleware('permission:users.manage');
    Route::post('/users/{user}/deactivate', [UserController::class, 'deactivate'])->middleware('permission:users.manage');
    Route::post('/users/{user}/reactivate', [UserController::class, 'reactivate'])->middleware('permission:users.manage');
    Route::delete('/users/{user}', [UserController::class, 'purge'])->middleware('permission:users.manage');

    Route::get('/roles', [RoleController::class, 'index'])->middleware('permission:users.manage');
    Route::post('/roles', [RoleController::class, 'store'])->middleware('permission:users.manage');
    Route::patch('/roles/{role}', [RoleController::class, 'update'])->middleware('permission:users.manage');

    Route::get('/devices', [DeviceController::class, 'index'])->middleware('permission:users.manage');
    Route::post('/devices/{device}/revoke', [DeviceController::class, 'revoke'])->middleware('permission:users.manage');

    Route::post('/sync/sample', [SyncController::class, 'sample']);
    Route::post('/sync/push', [SyncController::class, 'push']);
    Route::get('/sync/pull', [SyncController::class, 'pull']);
    Route::post('/files', [FileController::class, 'store']);
    Route::get('/files', [FileController::class, 'show']);
});
