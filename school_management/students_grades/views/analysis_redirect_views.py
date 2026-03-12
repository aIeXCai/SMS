from django.conf import settings
from django.http import HttpResponseRedirect


def _get_frontend_base_url(request):
    frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", "").strip()
    if frontend_base_url:
        return frontend_base_url.rstrip("/")

    host = request.get_host().split(":")[0]
    return f"http://{host}:3000"


def _redirect_to_frontend(request, frontend_path):
    base_url = _get_frontend_base_url(request)
    query_string = request.META.get("QUERY_STRING", "")
    target_url = f"{base_url}{frontend_path}"
    if query_string:
        target_url = f"{target_url}?{query_string}"
    return HttpResponseRedirect(target_url)


def redirect_class_grade_entry(request):
    return _redirect_to_frontend(request, "/analysis/class-grade")


def redirect_class_grade_single(request):
    return _redirect_to_frontend(request, "/analysis/class-grade/class")


def redirect_class_grade_grade(request):
    return _redirect_to_frontend(request, "/analysis/class-grade/grade")


def redirect_student_analysis_entry(request):
    return _redirect_to_frontend(request, "/analysis/student")


def redirect_student_analysis_detail(request):
    return _redirect_to_frontend(request, "/analysis/student/detail")
