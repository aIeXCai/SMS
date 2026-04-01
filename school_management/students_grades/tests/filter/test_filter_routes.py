from django.test import Client, TestCase


class FilterRoutesTest(TestCase):
    def setUp(self):
        self.client = Client()

    def test_advanced_filter_route_exists(self):
        # 未登录时认证先拦截（401/403），可证明路由已挂载且受保护
        get_resp = self.client.get('/api/students/advanced-filter/')
        self.assertIn(get_resp.status_code, (401, 403))

        # 未登录访问 POST 应被认证拦截（401/403）
        post_resp = self.client.post(
            '/api/students/advanced-filter/',
            data='{}',
            content_type='application/json',
        )
        self.assertIn(post_resp.status_code, (401, 403))

    def test_filter_rules_routes_exist(self):
        list_resp = self.client.get('/api/filter-rules/')
        self.assertIn(list_resp.status_code, (401, 403))

        detail_resp = self.client.get('/api/filter-rules/1/')
        self.assertIn(detail_resp.status_code, (401, 403))

    def test_filter_snapshots_routes_exist(self):
        list_resp = self.client.get('/api/filter-snapshots/')
        self.assertIn(list_resp.status_code, (401, 403))

        detail_resp = self.client.delete('/api/filter-snapshots/1/')
        self.assertIn(detail_resp.status_code, (401, 403))

    def test_compare_snapshots_route_exists(self):
        # 未登录时认证先拦截（401/403），可证明路由已挂载且受保护
        get_resp = self.client.get('/api/filter-snapshots/compare/')
        self.assertIn(get_resp.status_code, (401, 403))

        post_resp = self.client.post(
            '/api/filter-snapshots/compare/',
            data='{}',
            content_type='application/json',
        )
        self.assertIn(post_resp.status_code, (401, 403))
