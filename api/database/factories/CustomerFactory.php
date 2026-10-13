<?php

namespace Database\Factories;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Customer> */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    public function definition(): array
    {
        return [
            'shop_name' => fake()->company(),
            'contact' => fake()->name(),
            'phone' => fake()->numerify('91#######'),
            'nif' => fake()->unique()->numerify('#########'),
            'city' => 'Lisbon',
        ];
    }
}
