<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalletTransaction extends Model
{
    protected $fillable = [
        'wallet_id',
        'reference',
        'idempotency_key',
        'type',
        'provider',
        'usd_amount',
        'coins_delta',
        'balance_after',
        'status',
        'metadata',
        'webhook_verified_at',
    ];

    protected $casts = [
        'usd_amount' => 'decimal:2',
        'coins_delta' => 'integer',
        'balance_after' => 'integer',
        'metadata' => 'array',
        'webhook_verified_at' => 'datetime',
    ];

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }
}
