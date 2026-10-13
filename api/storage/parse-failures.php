<?php

$j = json_decode(file_get_contents($argv[1]), true);
echo 'keys: '.implode(',', array_keys($j)).PHP_EOL;
echo 'passed='.$j['passed'].' failed='.$j['failed'].' tests='.$j['tests'].PHP_EOL;
echo 'errors='.json_encode($j['errors']).PHP_EOL;
if (! empty($j['error_details'])) {
    $details = $j['error_details'];
    $first = is_array($details) ? (array_values($details)[0] ?? $details) : $details;
    echo substr(is_string($first) ? $first : json_encode($first), 0, 2500), PHP_EOL;
}
if (isset($j['error'])) {
    echo substr((string) $j['error'], 0, 500).PHP_EOL;
}
