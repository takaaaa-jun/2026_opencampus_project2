from django.urls import path

from . import views

urlpatterns = [
    path('pose/update/', views.pose_update, name='pose_update'),
    path('pose/latest/', views.pose_latest, name='pose_latest'),
    path('image/update/', views.image_update, name='image_update'),
    path('image/latest/', views.image_latest, name='image_latest'),
    path('auth/verify/', views.auth_verify, name='auth_verify'),
]