from django.conf import settings
from django.http import HttpResponse
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


def _redirect_to_api(request, api_path):
    query_string = request.META.get("QUERY_STRING", "")
    target_url = api_path
    if query_string:
        target_url = f"{target_url}?{query_string}"
    response = HttpResponse(status=307)
    response["Location"] = target_url
    return response


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


def redirect_score_list(request):
    return _redirect_to_frontend(request, "/scores")


def redirect_score_add(request):
    return _redirect_to_frontend(request, "/scores/add")


def redirect_score_edit(request, pk):
    return _redirect_to_frontend(request, "/scores")


def redirect_score_batch_edit(request):
    return _redirect_to_frontend(request, "/scores/batch-edit")


def redirect_score_query(request):
    return _redirect_to_frontend(request, "/scores/query")


def redirect_score_batch_export(request):
    return _redirect_to_api(request, "/api/scores/batch-export/")


def redirect_score_batch_delete_filtered(request):
    return _redirect_to_api(request, "/api/scores/batch-delete-filtered/")


def redirect_score_batch_export_selected(request):
    return _redirect_to_api(request, "/api/scores/batch-export-selected/")


def redirect_score_batch_delete_selected(request):
    return _redirect_to_api(request, "/api/scores/batch-delete-selected/")


def redirect_download_score_import_template(request):
    return _redirect_to_api(request, "/api/scores/download-template/")


def redirect_score_query_export(request):
    return _redirect_to_api(request, "/api/scores/query-export/")


def redirect_student_list(request):
    return _redirect_to_frontend(request, "/students")


def redirect_student_add(request):
    return _redirect_to_frontend(request, "/students/add")


def redirect_student_edit(request, pk):
    return _redirect_to_frontend(request, f"/students/{pk}/edit")


def redirect_student_batch_import_page(request):
    return _redirect_to_frontend(request, "/students")


def redirect_student_batch_promote_page(request):
    return _redirect_to_frontend(request, "/students/batch-promote")


def redirect_download_student_import_template(request):
    return _redirect_to_api(request, "/api/students/download-template/")


def redirect_student_delete(request, pk):
    return _redirect_to_frontend(request, "/students")


def redirect_student_update_status(request, pk):
    return _redirect_to_frontend(request, "/students")


def redirect_student_batch_delete(request):
    return _redirect_to_frontend(request, "/students")


def redirect_student_batch_update_status(request):
    return _redirect_to_frontend(request, "/students")


def redirect_student_batch_graduate(request):
    return _redirect_to_frontend(request, "/students")
