from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.views.decorators.http import require_http_methods, require_POST
from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Sum, Count, Q, F, Case, When, IntegerField, Avg, Max, Min
from django.db.models.functions import Rank
from django.core.paginator import Paginator
from django.http import HttpResponse, JsonResponse
import openpyxl
from datetime import datetime
from decimal import Decimal
import io, json, statistics, re, time
from collections import defaultdict
from .models import Exam, ExamSubject, Score, SUBJECT_CHOICES, SUBJECT_DEFAULT_MAX_SCORES, ACADEMIC_YEAR_CHOICES
from .forms import ExamCreateForm, ExamSubjectFormSet, ScoreForm, ScoreBatchUploadForm, ScoreQueryForm, ScoreAddForm, ScoreAnalysisForm
from .config import PAGINATION_CONFIG, TABLE_CONFIG, IMPORT_CONFIG
from school_management.students.models import CLASS_NAME_CHOICES, Student, Class, GRADE_LEVEL_CHOICES






