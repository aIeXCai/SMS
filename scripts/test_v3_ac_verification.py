"""AI Agent V3 真实 MiniMax M3 验收脚本 — AC-1 ~ AC-5"""

import json, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "school_management.settings")
import django
django.setup()

from school_management.students_grades.ai_agent.agent import run_agent
from school_management.users.models import CustomUser

user = CustomUser.objects.get(username="caijinbin")

results = []
passed = 0
failed = 0

def test(label, message, context=None, clarification_reply=None, checks=None):
    global passed, failed
    print(f"\n{'='*60}")
    print(f"[{label}]")
    print(f"  Input: {message}")
    t0 = time.time()
    try:
        resp = run_agent(
            user_message=message,
            context=context or {},
            clarification_reply=clarification_reply,
            user=user,
        )
        elapsed = time.time() - t0
        resp_type = resp.get("type", "?")
        resp_msg = resp.get("message", resp.get("summary", ""))[:150]
        tables_count = len(resp.get("tables", []))
        print(f"  Type: {resp_type} | Time: {elapsed:.1f}s | Tables: {tables_count}")
        print(f"  Message: {resp_msg}")

        check_results = []
        if checks:
            for check_name, check_fn in checks:
                ok = check_fn(resp)
                status = "✅" if ok else "❌"
                check_results.append((check_name, ok))
                print(f"  {status} {check_name}")

        all_ok = all(r[1] for r in check_results) if check_results else (resp_type == "answer")
        if all_ok:
            passed += 1
            print(f"  >>> PASS")
        else:
            failed += 1
            print(f"  >>> FAIL")

        results.append({
            "label": label,
            "input": message,
            "type": resp_type,
            "time": f"{elapsed:.1f}s",
            "message": resp_msg,
            "checks": [(n, ok) for n, ok in check_results] if check_results else [],
            "passed": all_ok,
        })
        return resp
    except Exception as e:
        elapsed = time.time() - t0
        print(f"  ❌ ERROR: {e} (after {elapsed:.1f}s)")
        failed += 1
        results.append({"label": label, "input": message, "type": "error", "time": f"{elapsed:.1f}s", "error": str(e), "passed": False})
        return None

# ═══════════════════════════════════════════════════════════════
# AC-1: 单人精准排名
# "初二14班黄晨田期末模拟考年级排名"
# 预期：一次返回 "黄晨田排第 X/共 Y 名"
# ═══════════════════════════════════════════════════════════════
r1 = test(
    "AC-1 单人年级排名",
    "初二14班黄晨田期末模拟考年级排名",
    checks=[
        ("响应类型为 answer", lambda r: r.get("type") == "answer"),
        ("message 含 '黄晨田'", lambda r: "黄晨田" in (r.get("message") or r.get("summary", ""))),
        ("message 含排名信息(排/名/第)", lambda r: any(
            k in (r.get("message") or r.get("summary", "")) for k in ["排第", "排名", "名"])
        ),
    ],
)

# ═══════════════════════════════════════════════════════════════
# AC-2: 多轮追问继承上下文
# 追问 "刘畅呢" — 应自动继承年级/考试
# ═══════════════════════════════════════════════════════════════
r1_context = r1.get("context", {}) if r1 else {}
r2 = test(
    "AC-2 追问继承",
    "刘畅呢",
    context=r1_context,
    checks=[
        ("响应类型为 answer", lambda r: r.get("type") == "answer"),
        ("message 含 '刘畅'", lambda r: "刘畅" in (r.get("message") or r.get("summary", ""))),
        ("message 含排名信息", lambda r: any(
            k in (r.get("message") or r.get("summary", "")) for k in ["排第", "排名", "名"])
        ),
    ],
)

# ═══════════════════════════════════════════════════════════════
# AC-3: 加权排名
# "初二格致班期中期末6:4加权前三"
# 预期：正确加权并排名，含权重、分科得分
# ═══════════════════════════════════════════════════════════════
r3 = test(
    "AC-3 加权排名",
    "初二格致班期中期末6:4加权前三",
    checks=[
        ("响应类型为 answer", lambda r: r.get("type") == "answer"),
        ("message 或 tables 含排名/加权结果", lambda r: (
            "排名" in (r.get("message") or r.get("summary", "")) or
            "加权" in (r.get("message") or r.get("summary", "")) or
            len(r.get("tables", [])) > 0
        )),
    ],
)

# ═══════════════════════════════════════════════════════════════
# AC-4: 趋势分析
# "张三数学最近5次变化" — 注意数据库无张三
# 改用有数据的 "黄晨田数学最近5次变化"
# ═══════════════════════════════════════════════════════════════
r4 = test(
    "AC-4 趋势分析",
    "黄晨田数学最近5次变化",
    checks=[
        ("响应类型为 answer", lambda r: r.get("type") == "answer"),
        ("message/tables 含趋势数据", lambda r: (
            "趋势" in (r.get("message") or r.get("summary", "")) or
            "变化" in (r.get("message") or r.get("summary", "")) or
            len(r.get("tables", [])) > 0
        )),
    ],
)

# ═══════════════════════════════════════════════════════════════
# AC-5: 跨群体对比
# "初二10班数学在南山班排第几"
# ═══════════════════════════════════════════════════════════════
r5 = test(
    "AC-5 跨群体对比",
    "初二10班数学在南山班排第几",
    checks=[
        ("响应类型为 answer 或 clarification", lambda r: r.get("type") in ("answer", "clarification")),
        ("如果 answer, 含对比信息", lambda r: (
            r.get("type") != "answer" or
            "南山" in (r.get("message") or r.get("summary", "")) or
            "10班" in (r.get("message") or r.get("summary", "")) or
            len(r.get("tables", [])) > 0
        )),
    ],
)

# ═══════════════════════════════════════════════════════════════
# 汇总
# ═══════════════════════════════════════════════════════════════
print(f"\n{'='*60}")
print(f"汇总: {passed}/{passed+failed} 通过")
for r in results:
    status = "✅" if r["passed"] else "❌"
    print(f"  {status} {r['label']} ({r['time']})")

# 输出 JSON 供后续分析
with open("/Users/caijinbin/Desktop/白实/信息/信息管理系统/SMS/scripts/v3_ac_results.json", "w") as f:
    json.dump(results, f, ensure_ascii=False, indent=2, default=str)
print(f"\n详细结果已保存到 scripts/v3_ac_results.json")
sys.exit(0 if failed == 0 else 1)
