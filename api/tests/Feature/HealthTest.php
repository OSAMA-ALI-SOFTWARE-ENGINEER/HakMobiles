<?php

it('returns ok from the health endpoint', function () {
    $this->getJson('/api/health')
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonStructure(['time']);
});
