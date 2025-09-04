from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """
    允許在 Django 模板中通過變數訪問字典的鍵。
    例如：{{ my_dict|get_item:my_key_variable }}
    """
    return dictionary.get(key)

@register.filter
def mul(value, arg):
    """
    乘法过滤器，用于在模板中进行乘法运算
    例如：{{ forloop.counter0|mul:0.1 }}
    """
    try:
        return float(value) * float(arg)
    except (ValueError, TypeError):
        return 0
