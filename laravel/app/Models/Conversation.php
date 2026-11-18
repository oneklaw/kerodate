<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    public const FREE_MESSAGES_LIMIT = 4;

    protected $fillable = [
        'initiator_id',
        'recipient_id',
        'initiator_free_messages_used',
        'recipient_free_messages_used',
        'last_message_at',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
    ];

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at');
    }

    public function freeMessagesRemainingFor(int $userId): int
    {
        $used = $userId === $this->initiator_id
            ? $this->initiator_free_messages_used
            : $this->recipient_free_messages_used;

        return max(0, self::FREE_MESSAGES_LIMIT - $used);
    }
}
