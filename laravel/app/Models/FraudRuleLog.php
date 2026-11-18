<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FraudRuleLog extends Model
{
    protected $fillable = [
        'user_id',
        'channel',
        'rule_code',
        'risk_score',
        'blocked',
        'ip_address',
        'context',
    ];

    protected $casts = [
        'risk_score' => 'integer',
        'blocked' => 'boolean',
        'context' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
