<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class ChatAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $throttleKey = 'chat-login:' . Str::lower($validated['email']) . '|' . $request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            return response()->json([
                'message' => 'Too many login attempts. Try again in 60 seconds.',
            ], 429);
        }

        $user = User::where('email', $validated['email'])->first();
        if (!$user || !Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($throttleKey, 60);
            return response()->json(['message' => 'Invalid email or password.'], 401);
        }

        RateLimiter::clear($throttleKey);

        // Issue scoped Sanctum token restricted to encrypted chat & wallet scopes
        $token = $user->createToken('kero-chat-session', ['chat:read', 'chat:send'])->plainTextToken;

        return response()->json([
            'authenticated' => true,
            'token' => $token,
            'user' => ['id' => $user->id, 'email' => $user->email, 'name' => $user->name],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['authenticated' => false]);
    }
}
