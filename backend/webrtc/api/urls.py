"""WebRTC用HTTP APIのURL定義。"""

from django.urls import path

from . import views

urlpatterns = [
    path('offer/', views.offer, name='offer'),
]
