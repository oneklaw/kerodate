<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Wallet extends Model
{
    protected $fillable = [
        'user_id',
        'coin_balance',
        'lifetime_coins_purchased',
        'lifetime_coins_spent',
        'low_balance_threshold',
        'low_balance_notified_at',
    ];

    protected $casts = [
        'coin_balance' => 'integer',
        'lifetime_coins_purchased' => 'integer',
        'lifetime_coins_spent' => 'integer',
        'low_balance_threshold' => 'integer',
        'low_balance_notified_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class)->latest();
    }

    public function isLowBalance(): bool
    {
        return $this->coin_balance <= $this->low_balance_threshold;
    }
}
