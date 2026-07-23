import json
from aiortc import RTCSessionDescription
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from django.views.decorators.clickjacking import xframe_options_exempt

from ..rtc.session import rtc_session_manager


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


@xframe_options_exempt
def index_view(request):
    return render(request, 'index.html')
