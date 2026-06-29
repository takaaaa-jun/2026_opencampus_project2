from __future__ import annotations

import json

from asgiref.sync import async_to_sync
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .media import peer_manager


def _parse_json(request):
    try:
        body = request.body.decode('utf-8') if request.body else '{}'
        return json.loads(body)
    except json.JSONDecodeError:
        return None


@csrf_exempt
def offer_send(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    data = _parse_json(request)
    if data is None:
        return JsonResponse({'detail': 'Invalid JSON.'}, status=400)

    room_id = data.get('room_id') or 'default'
    offer = data.get('offer')

    if not isinstance(offer, dict) or 'sdp' not in offer or 'type' not in offer:
        return JsonResponse({'detail': 'offer is required.'}, status=400)

    session_id, answer = async_to_sync(peer_manager.create_sender_answer)(room_id, offer)

    return JsonResponse(
        {
            'session_id': session_id,
            'room_id': room_id,
            'answer': answer,
        }
    )


@csrf_exempt
def offer_view(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    data = _parse_json(request)
    if data is None:
        return JsonResponse({'detail': 'Invalid JSON.'}, status=400)

    room_id = data.get('room_id') or 'default'
    offer = data.get('offer')

    if not isinstance(offer, dict) or 'sdp' not in offer or 'type' not in offer:
        return JsonResponse({'detail': 'offer is required.'}, status=400)

    result = async_to_sync(peer_manager.create_viewer_answer)(room_id, offer)
    if result is None:
        return JsonResponse({'detail': 'Sender not ready yet.'}, status=409)

    session_id, answer = result

    return JsonResponse(
        {
            'session_id': session_id,
            'room_id': room_id,
            'answer': answer,
        }
    )


@csrf_exempt
def pose_update(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    data = _parse_json(request)
    if data is None:
        return JsonResponse({'detail': 'Invalid JSON.'}, status=400)

    room_id = data.get('room_id') or 'default'
    peer_manager.update_pose(room_id, data)

    return JsonResponse({'ok': True, 'room_id': room_id})


def pose_latest(request):
    if request.method != 'GET':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    room_id = request.GET.get('room_id') or 'default'
    pose = peer_manager.get_latest_pose(room_id)

    if pose is None:
        return JsonResponse({'detail': 'Not found.'}, status=404)

    return JsonResponse({'room_id': room_id, 'pose': pose})


@csrf_exempt
def close(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    data = _parse_json(request)
    if data is None:
        return JsonResponse({'detail': 'Invalid JSON.'}, status=400)

    session_id = data.get('session_id')
    if not session_id:
        return JsonResponse({'detail': 'session_id is required.'}, status=400)

    async_to_sync(peer_manager.close_session)(session_id)

    return JsonResponse({'ok': True})


from django.shortcuts import render
from django.views.decorators.clickjacking import xframe_options_exempt

@xframe_options_exempt
def index_view(request):
    return render(request, 'index.html')