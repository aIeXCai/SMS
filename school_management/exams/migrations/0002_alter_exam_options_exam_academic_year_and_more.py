# Generated by Django 5.2.4 on 2025-07-31 02:39

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('exams', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='exam',
            options={'ordering': ['-date', 'grade_level', 'name'], 'verbose_name': '考试', 'verbose_name_plural': '考试管理'},
        ),
        migrations.AddField(
            model_name='exam',
            name='academic_year',
            field=models.CharField(blank=True, choices=[('2025-2026', '2025-2026'), ('2026-2027', '2026-2027'), ('2027-2028', '2027-2028'), ('2028-2029', '2028-2029'), ('2029-2030', '2029-2030')], help_text='請選擇考試所屬的學年 (例如: 2025-2026)', max_length=10, null=True, verbose_name='學年'),
        ),
        migrations.AlterField(
            model_name='exam',
            name='description',
            field=models.TextField(blank=True, help_text='可选：填写考试的相关说明或注意事项', null=True, verbose_name='考试描述'),
        ),
        migrations.AlterUniqueTogether(
            name='exam',
            unique_together={('academic_year', 'name')},
        ),
    ]
