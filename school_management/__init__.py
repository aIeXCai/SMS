import pymysql

# 让 PyMySQL 以 MySQLdb 方式工作，兼容 Django 的 mysql backend。
pymysql.install_as_MySQLdb()
