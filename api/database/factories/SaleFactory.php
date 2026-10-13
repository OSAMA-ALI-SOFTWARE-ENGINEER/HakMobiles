<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Sale;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Sale>
 */
class SaleFactory extends Factory
{
    protected $model = Sale::class;

    public function definition(): array
    {
        return [
            'invoice_no' => fake()->unique()->bothify('INV-####'),
            'customer_id' => Customer::factory(),
            'date' => now()->toDateString(),
            'note' => null,
        ];
    }
}
