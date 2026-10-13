<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Product;
use App\Models\SyncChange;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FileController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'table' => ['required', 'in:products,expenses,users'],
            'record_id' => ['required', 'uuid'],
            'file' => ['required', 'file', 'max:10240'],
        ]);

        if ($data['table'] === 'users') {
            abort_unless($data['record_id'] === $request->user()->id, 403);
            $path = $request->file('file')->store('uploads/avatars', 'public');
            $request->user()->forceFill(['avatar_path' => $path])->save();
            Audit::log('file.uploaded', $request->user(), ['path' => $path]);

            return response()->json(['path' => $path]);
        }

        $record = $data['table'] === 'products'
            ? Product::query()->findOrFail($data['record_id'])
            : Expense::query()->findOrFail($data['record_id']);

        $path = $request->file('file')->store('uploads/'.$data['table'], 'public');
        $column = $data['table'] === 'products' ? 'photo_path' : 'receipt_path';
        $record->forceFill([$column => $path, 'updated_by' => $request->user()->id])->save();

        SyncChange::query()->create([
            'table_name' => $data['table'],
            'record_id' => $record->id,
            'changed_at' => now(),
        ]);
        Audit::log('file.uploaded', $record, ['path' => $path]);

        return response()->json(['path' => $path]);
    }

    public function show(Request $request): StreamedResponse
    {
        $path = (string) $request->query('path', '');
        abort_unless($path !== '' && ! str_contains($path, '..') && Storage::disk('public')->exists($path), 404);

        return Storage::disk('public')->download($path);
    }
}
