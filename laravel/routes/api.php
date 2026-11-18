<?php

use App\Http\Controllers\TopUpController;
use App\Http\Controllers\WebhookController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/wallet/topup', [TopUpController::class, 'show'])->name('wallet.topup');
    Route::post('/wallet/topup', [TopUpController::class, 'initiate'])->name('wallet.topup.initiate');
});

Route::post('/webhooks/flutterwave', [WebhookController::class, 'handleFlutterwave'])
    ->name('webhooks.flutterwave');

Route::post('/webhooks/mtn-momo', [WebhookController::class, 'handleMtnMomo'])
    ->name('webhooks.mtn_momo');
