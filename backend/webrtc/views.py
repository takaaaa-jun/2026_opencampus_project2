import json
from aiortc import RTCSessionDescription
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from django.views.decorators.clickjacking import xframe_options_exempt

from .services import relay_service
from .rtc_session import rtc_session_manager


def _parse_json(request):
    try:
        body = request.body.decode('utf-8') if request.body else '{}'
        return json.loads(body)
    except json.JSONDecodeError:
        return None


@csrf_exempt
def offer(request):
    """フロントエンドのOfferを受け取り、WebRTC Answerを返す。"""
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    data = _parse_json(request)
    if data is None:
        return JsonResponse({'detail': 'Invalid JSON.'}, status=400)

    offer_type = data.get('type')
    offer_sdp = data.get('sdp')
    if offer_type != 'offer' or not isinstance(offer_sdp, str) or not offer_sdp:
        return JsonResponse({'detail': 'An SDP offer is required.'}, status=400)

    try:
        answer = rtc_session_manager.create_answer(
            RTCSessionDescription(sdp=offer_sdp, type=offer_type),
        )
    except Exception:
        return JsonResponse({'detail': 'WebRTC negotiation failed.'}, status=500)

    return JsonResponse({'type': answer.type, 'sdp': answer.sdp})


@csrf_exempt
def pose_update(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    data = _parse_json(request)
    if data is None:
        return JsonResponse({'detail': 'Invalid JSON.'}, status=400)

    room_id = data.get('room_id') or 'default'
    try:
        relay_service.update_pose(room_id, data)
        return JsonResponse({'ok': True, 'room_id': room_id})
    except Exception as e:
        return JsonResponse({'detail': str(e)}, status=500)


def pose_latest(request):
    if request.method != 'GET':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    room_id = request.GET.get('room_id') or 'default'
    pose = relay_service.get_latest_pose(room_id)

    if pose is None:
        return JsonResponse({'detail': 'Not found.'}, status=404)

    # domain.PoseFrameオブジェクトを辞書に変換してレスポンス
    return JsonResponse({
        'room_id': pose.room_id,
        'pose': {
            'room_id': pose.room_id,
            'updated_at': pose.updated_at,
            'image_width': pose.image_width,
            'image_height': pose.image_height,
            'landmarks': pose.landmarks,
        }
    })


@csrf_exempt
def image_update(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    data = _parse_json(request)
    if data is None:
        return JsonResponse({'detail': 'Invalid JSON.'}, status=400)

    room_id = data.get('room_id') or 'default'
    image_data = data.get('image')  # base64 string
    if not image_data:
        return JsonResponse({'detail': 'image field is required.'}, status=400)

    try:
        relay_service.update_image(room_id, image_data)
        return JsonResponse({'ok': True, 'room_id': room_id})
    except Exception as e:
        return JsonResponse({'detail': str(e)}, status=500)


def image_latest(request):
    if request.method != 'GET':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    room_id = request.GET.get('room_id') or 'default'
    image = relay_service.get_latest_image(room_id)

    if image is None:
        return JsonResponse({'detail': 'Not found.'}, status=404)

    return JsonResponse({
        'room_id': image.room_id,
        'image': image.image_data,
    })


@xframe_options_exempt
def index_view(request):
    return render(request, 'index.html')

