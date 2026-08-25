from rest_framework.pagination import PageNumberPagination


class HistoryPagination(PageNumberPagination):
    """Paged history so a large gallery never ships in one response (PRD 16)."""

    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 48
