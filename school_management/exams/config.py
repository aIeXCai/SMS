# 成绩管理页面配置设置

# 分页配置
PAGINATION_CONFIG = {
    # 默认每页显示条数
    'DEFAULT_PER_PAGE': 100,
    
    # 可选的每页显示条数选项
    'PER_PAGE_OPTIONS': [50, 100, 200, 500],
    
    # 最小每页显示条数
    'MIN_PER_PAGE': 5,
    
    # 最大每页显示条数（防止性能问题）
    'MAX_PER_PAGE': 500,
    
    # 分页显示范围（当前页前后显示的页码数量）
    'PAGE_RANGE': 10,
}

# 表格显示配置
TABLE_CONFIG = {
    # 最大查询记录数（防止内存溢出）
    'MAX_QUERY_LIMIT': 2000,
    
    # 筛选选项显示限制
    'FILTER_OPTIONS_LIMIT': 100,
}

# 导入配置
IMPORT_CONFIG = {
    # 批量操作时的批次大小
    'BATCH_SIZE': 1000,
    
    # 返回错误详情的最大数量
    'MAX_ERROR_DETAILS': 20,
}
