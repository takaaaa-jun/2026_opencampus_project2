import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from django.views.decorators.clickjacking import xframe_options_exempt
from django.conf import settings

from .services import relay_service


def _parse_json(request):
    try:
        body = request.body.decode('utf-8') if request.body else '{}'
        return json.loads(body)
    except json.JSONDecodeError:
        return None


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


@csrf_exempt
def auth_verify(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    data = _parse_json(request)
    if data is None:
        return JsonResponse({'detail': 'Invalid JSON.'}, status=400)

    password = data.get('password')
    correct_password = getattr(settings, 'OPENCAMPUS_PASSWORD', None)

    if password == correct_password:
        return JsonResponse({'ok': True})
    else:
        return JsonResponse({'ok': False, 'detail': 'Incorrect password.'}, status=401)