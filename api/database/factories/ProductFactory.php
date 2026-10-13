<?php

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Product> */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'code' => strtoupper(fake()->unique()->bothify('??####')),
            'name' => fake()->words(2, true),
            'category' => 'Cases',
            'colour' => 'Black',
            'sell_price' => 5,
            'alert_level' => 10,
        ];
    }
}
