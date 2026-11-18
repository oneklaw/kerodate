<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NearbyLocatorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'radius_km' => ['nullable', 'numeric', 'min:1', 'max:200'],
            'online_only' => ['nullable', 'boolean'],
        ]);

        $lat = (float) $validated['lat'];
        $lng = (float) $validated['lng'];
        $radiusKm = (float) ($validated['radius_km'] ?? 15);
        $onlineOnly = (bool) ($validated['online_only'] ?? true);

        $haversine = '(6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))';

        $query = User::query()
            ->select(['id', 'name', 'city', 'occupation', 'latitude', 'longitude', 'last_seen_at'])
            ->selectRaw("{$haversine} AS distance_km", [$lat, $lng, $lat])
            ->where('id', '!=', $request->user()->id)
            ->having('distance_km', '<=', $radiusKm)
            ->orderBy('distance_km');

        if ($onlineOnly) {
            $query->where('last_seen_at', '>=', now()->subMinutes(5));
        }

        return response()->json([
            'origin' => ['lat' => $lat, 'lng' => $lng, 'radius_km' => $radiusKm],
            'members' => $query->limit(40)->get(),
        ]);
    }
}
