<?php

return [

    /*
    | Two-factor login for Super Admin and Partner is built and kept off
    | until it is turned on with HAK_TWO_FACTOR=true.
    */
    'two_factor_enabled' => (bool) env('HAK_TWO_FACTOR', false),

];
