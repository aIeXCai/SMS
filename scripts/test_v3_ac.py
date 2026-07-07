#!/usr/bin/env python
"""V3 Agent Acceptance Test — runs AC-1 through AC-5 with real MiniMax M3.

Usage:
    cd /path/to/SMS
    python scripts/test_v3_ac.py
"""

import json
import os
import sys
import time

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "school_management.settings")
os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"
django.setup()

from school_management.students_grades.ai_agent.agent import run_agent

PASS = "\033[92m✅ PASS\033[0m"
FAIL = "\033[91m❌ FAIL\033[0m"
WARN = "\033[93m⚠️ WARN\033[0m"


def check(result, expected_type, test_name):
    """Basic result check."""
    actual_type = result.get("type")
    status = result.get("status", "")
    summary = result.get("summary", "") or result.get("message", "")
    tables = result.get("tables", [])
    options = result.get("options", [])

    print(f"\n--- {test_name} ---")
    print(f"  type: {actual_type}")
    print(f"  status: {status}")
    print(f"  summary: {str(summary)[:300]}")
    if tables:
        print(f"  tables: {len(tables)}")
        for t in tables:
            print(f"    [{t.get('title','-')}] cols={len(t.get('columns',[]))} rows={len(t.get('rows',[]))}")
            if t.get('rows'):
                print(f"     row0: {t['rows'][0]}")
    else:
        print(f"  tables: EMPTY")
        # Print raw text
        raw_text = result.get("summary", "") or result.get("message", "")
        print(f"  Full text: {raw_text[:500]}")
    if options:
        print(f"  options: {len(options)}")
        for o in options[:3]:
            print(f"    -> {o.get('label','')} (value={o.get('value','')}, payload={o.get('payload',{})})")
    print()

    return actual_type == expected_type


def main():
    results = []
    context = None  # shared conversation context

    # =============================================
    # AC-1: 精准单人排名
    # =============================================
    print("=" * 60)
    print("AC-1: 初二14班黄晨田期末模拟考年级排名")
    print("=" * 60)

    r1 = run_agent("初二14班黄晨田期末模拟考年级排名", context or {})
    r1_type = r1.get("type")

    if r1_type == "answer":
        ok = r1.get("status") == "success" and r1.get("tables")
        results.append(("AC-1 精准排名", ok, "直接返回排名" if ok else "返回了answer但无表格"))
        if ok:
            context = r1.get("context", {})
    elif r1_type == "clarification":
        options = r1.get("options", [])
        print(f"  -> LLM 追问（{len(options)} 个选项），选择第一个继续...")
        if options:
            context = r1.get("context", {})
            opt = options[0]
            r1b = run_agent(
                "初二14班黄晨田期末模拟考年级排名",
                context,
                clarification_reply={
                    "question_id": r1.get("question_id", ""),
                    "value": opt.get("value", ""),
                    "label": opt.get("label", ""),
                    "payload": opt.get("payload", {}),
                },
            )
            r1b_type = r1b.get("type")
            r1b_ok = r1b_type == "answer" and r1b.get("status") == "success" and r1b.get("tables")
            results.append(("AC-1 精准排名（消歧后）", r1b_ok, f"消歧后 type={r1b_type}" + (" tables有数据" if r1b.get("tables") else "")))
            if r1b_ok:
                context = r1b.get("context", {})
    else:
        results.append(("AC-1 精准排名", False, f"意外type={r1_type}"))

    time.sleep(1)

    # =============================================
    # AC-2: 追问上下文继承（"刘畅呢"）
    # =============================================
    if context:
        print("=" * 60)
        print("AC-2: 追问「刘畅呢」（上下文继承）")
        print("=" * 60)

        r2 = run_agent("刘畅呢", context)
        r2_type = r2.get("type")
        r2_ok = (r2_type == "answer" and r2.get("status") == "success"
                 and r2.get("tables") and "刘畅" in str(r2))
        no_reask = r2_type != "clarification"
        results.append(("AC-2 上下文继承", r2_ok and no_reask,
                       f"type={r2_type}, 含刘畅={('刘畅' in str(r2))}, 未重新追问={no_reask}"))
        if r2_ok:
            context = r2.get("context", {})
    else:
        results.append(("AC-2 上下文继承", False, "无AC-1上下文可继承"))
        context = None

    time.sleep(1)

    # =============================================
    # AC-3: 加权排名
    # =============================================
    print("=" * 60)
    print("AC-3: 初二格致班期中期末6:4加权前三")
    print("=" * 60)

    r3 = run_agent("初二格致班期中期末6:4加权前三", {})
    r3_type = r3.get("type")

    if r3_type == "answer":
        r3_ok = r3.get("status") == "success" and r3.get("tables")
        results.append(("AC-3 加权排名", r3_ok, "直接返回加权结果" if r3_ok else "返回answer无表格"))
    elif r3_type == "clarification":
        options = r3.get("options", [])
        print(f"  -> LLM 追问（{len(options)} 个选项），选择第一个继续...")
        if options:
            ctx = r3.get("context", {})
            opt = options[0]
            r3b = run_agent(
                "初二格致班期中期末6:4加权前三",
                ctx,
                clarification_reply={
                    "question_id": r3.get("question_id", ""),
                    "value": opt.get("value", ""),
                    "label": opt.get("label", ""),
                    "payload": opt.get("payload", {}),
                },
            )
            r3b_ok = r3b.get("type") == "answer" and r3b.get("tables")
            results.append(("AC-3 加权排名（消歧后）", r3b_ok, f"消歧后type={r3b.get('type')}"))
    else:
        results.append(("AC-3 加权排名", False, f"意外type={r3_type}"))

    time.sleep(1)

    # =============================================
    # AC-4: 学生趋势
    # =============================================
    print("=" * 60)
    print("AC-4: 张三数学最近5次变化")
    print("=" * 60)

    r4 = run_agent("张三数学最近5次变化", {})
    r4_type = r4.get("type")

    if r4_type == "answer":
        r4_ok = r4.get("status") == "success" and r4.get("tables")
        rows_count = 0
        if r4_ok and r4.get("tables"):
            rows_count = len(r4["tables"][0].get("rows", []))
        results.append(("AC-4 趋势", r4_ok and rows_count >= 1,
                       f"rows={rows_count}"))
    elif r4_type == "clarification":
        results.append(("AC-4 趋势", False, "LLM追问中"))
    else:
        results.append(("AC-4 趋势", False, f"意外type={r4_type}"))

    time.sleep(1)

    # =============================================
    # AC-5: 跨群体对比
    # =============================================
    print("=" * 60)
    print("AC-5: 初二10班数学在南山班排第几")
    print("=" * 60)

    r5 = run_agent("初二10班数学在南山班排第几", {})
    r5_type = r5.get("type")

    if r5_type == "answer":
        r5_ok = r5.get("status") == "success"
        results.append(("AC-5 对比", r5_ok, f"返回={r5_type}"))
    elif r5_type == "clarification":
        options = r5.get("options", [])
        print(f"  -> LLM 追问（{len(options)} 个选项），选择第一个继续...")
        if options:
            ctx = r5.get("context", {})
            opt = options[0]
            r5b = run_agent(
                "初二10班数学在南山班排第几",
                ctx,
                clarification_reply={
                    "question_id": r5.get("question_id", ""),
                    "value": opt.get("value", ""),
                    "label": opt.get("label", ""),
                    "payload": opt.get("payload", {}),
                },
            )
            r5b_ok = r5b.get("type") == "answer"
            results.append(("AC-5 对比（消歧后）", r5b_ok, f"消歧后type={r5b.get('type')}"))
    else:
        results.append(("AC-5 对比", False, f"意外type={r5_type}"))

    # =============================================
    # Summary
    # =============================================
    print("=" * 60)
    print("结果汇总")
    print("=" * 60)
    passed = 0
    failed = 0
    for name, ok, note in results:
        status = PASS if ok else FAIL
        print(f"  {status} {name}: {note}")
        if ok:
            passed += 1
        else:
            failed += 1
    print(f"\n通过: {passed}/{passed+failed}")


if __name__ == "__main__":
    main()
