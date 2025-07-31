from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """
    允許在 Django 模板中通過變數訪問字典的鍵。
    例如：{{ my_dict|get_item:my_key_variable }}
    """
    return dictionary.get(key)