<?php

use App\Models\Setting;

it('shows the company name and logo without a login', function () {
    Setting::query()->create(['key' => 'company_name', 'value' => 'HAK Porto']);
    Setting::query()->create(['key' => 'document_design', 'value' => ['logo' => 'data:image/png;base64,abc', 'color' => 'teal']]);
    Setting::query()->create(['key' => 'company_email', 'value' => 'private@example.test']);

    $this->getJson('/api/brand')
        ->assertOk()
        ->assertJson([
            'name' => 'HAK Porto',
            'logo' => 'data:image/png;base64,abc',
            'color' => 'teal',
        ])
        ->assertJsonMissing(['private@example.test']);
});

it('ignores a logo that is not an uploaded image', function () {
    Setting::query()->create(['key' => 'document_design', 'value' => ['logo' => 'https://example.test/logo.png', 'color' => 'rainbow']]);

    $this->getJson('/api/brand')
        ->assertOk()
        ->assertJson([
            'name' => 'HAK Wholesales',
            'logo' => '',
            'color' => 'indigo',
        ]);
});
