from django.contrib import admin
from django.urls import include, path, re_path
from webrtc.api.views import index_view

urlpatterns = [
    path('api/webrtc/', include('webrtc.api.urls')),
    path('admin/', admin.site.urls),
    re_path(r'^(?!api/|admin/).*$', index_view, name='index'),
]
