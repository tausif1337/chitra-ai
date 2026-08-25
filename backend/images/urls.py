from django.urls import path

from . import views

app_name = "images"

urlpatterns = [
    path("generate/", views.GenerateImageView.as_view(), name="generate"),
    path("options/", views.GenerationOptionsView.as_view(), name="options"),
    path("<int:pk>/", views.ImageDetailView.as_view(), name="detail"),
    path("", views.ImageListView.as_view(), name="list"),
]
