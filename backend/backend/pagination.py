from rest_framework.pagination import PageNumberPagination
from rest_framework.utils.urls import remove_query_param, replace_query_param


class RelativePageNumberPagination(PageNumberPagination):
    """
    Build relative pagination links so list endpoints keep working even when the
    request host is not whitelisted. This is especially helpful for LAN/dev
    access where browsers may hit the same server through different hostnames.
    """

    def _get_relative_path(self):
        path = self.request.get_full_path()
        if not path.startswith('/'):
            return f'/{path}'
        return path

    def get_next_link(self):
        if not self.page.has_next():
            return None

        url = self._get_relative_path()
        page_number = self.page.next_page_number()
        return replace_query_param(url, self.page_query_param, page_number)

    def get_previous_link(self):
        if not self.page.has_previous():
            return None

        url = self._get_relative_path()
        page_number = self.page.previous_page_number()
        if page_number == 1:
            return remove_query_param(url, self.page_query_param)
        return replace_query_param(url, self.page_query_param, page_number)
