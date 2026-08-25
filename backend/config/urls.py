from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from images.views import HealthView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/auth/", include("accounts.urls")),
    path("api/images/", include("images.urls")),
]

if settings.DEBUG:
    # In production nginx serves /media/ directly; see deploy/nginx.conf.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
