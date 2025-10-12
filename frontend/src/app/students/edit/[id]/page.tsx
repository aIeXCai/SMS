'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import styles from '@/app/students/add/add.module.css'; // 复用新增页面的样式
import { FaSave, FaTimes, FaUserEdit, FaArrowLeft } from 'react-icons/fa';

// Define the types for the data
interface ClassInfo {
    id: number;
    grade_level: string;
    class_name: string;
}

interface Student {
    id: number;
    student_id: string;
    name: string;
    gender: string;
    date_of_birth: string;
    current_class: ClassInfo | null;
    status: string;
    grade_level: string;
}

const GRADE_LEVEL_CHOICES = ['高一', '高二', '高三', '初一', '初二', '初三'];
const STATUS_CHOICES = ['在读', '转学', '休学', '复学', '毕业'];
const CLASS_NAME_CHOICES = Array.from({ length: 20 }, (_, i) => `${i + 1}班`);

const EditStudentPage = () => {
    const { isAuthenticated, isInitializing } = useAuth();
    const router = useRouter();
    const params = useParams();
    const studentId = params.id;

    const [formData, setFormData] = useState({
        student_id: '',
        name: '',
        gender: '男',
        date_of_birth: '',
        status: '在读',
        grade_level: '',
        class_name: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const fetchStudentData = useCallback(async () => {
        if (!studentId) return;
        const token = localStorage.getItem('accessToken');
        if (!token) {
            router.push('/login');
            return;
        }
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/students/${studentId}/`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                throw new Error('获取学生信息失败');
            }
            const data: Student = await response.json();
            setFormData({
                student_id: data.student_id,
                name: data.name,
                gender: data.gender,
                date_of_birth: data.date_of_birth,
                status: data.status,
                grade_level: data.current_class?.grade_level || data.grade_level || '',
                class_name: data.current_class?.class_name || '',
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [studentId, router]);

    useEffect(() => {
        if (!isInitializing && !isAuthenticated) {
            router.push('/login');
        } else if (isAuthenticated) {
            fetchStudentData();
        }
    }, [isInitializing, isAuthenticated, router, fetchStudentData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        if (!isAuthenticated) {
            setError('认证失败，请重新登录。');
            return;
        }

        setIsSaving(true);

        const token = localStorage.getItem('accessToken');
        if (!token) {
            setError("认证失败，请重新登录。");
            setIsSaving(false);
            return;
        }

        const payload = {
            student_id: formData.student_id,
            name: formData.name,
            gender: formData.gender,
            date_of_birth: formData.date_of_birth,
            status: formData.status,
            grade_level: formData.grade_level,
            current_class: {
                grade_level: formData.grade_level,
                class_name: formData.class_name,
            }
        };

        try {
            const response = await fetch(`http://127.0.0.1:8000/api/students/${studentId}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                router.push('/students');
                return;
            }

            const errorData = await response.json();
            if (response.status === 400 && typeof errorData === 'object') {
                const formattedErrors: Record<string, string> = {};
                Object.entries(errorData).forEach(([key, value]) => {
                    if (Array.isArray(value)) {
                        formattedErrors[key] = value.join(' ');
                    } else if (typeof value === 'string') {
                        formattedErrors[key] = value;
                    }
                });
                setFieldErrors(formattedErrors);
                setError('请检查表单中的错误。');
            } else {
                setError(errorData.detail || '更新学生信息失败');
            }

        } catch (err: any) {
            setError(err.message || '更新学生信息失败');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading || isInitializing) {
        return <div className={styles.loading}>正在加载学生信息...</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <h1><FaUserEdit style={{ marginRight: '1rem' }} />编辑学生</h1>
                <button onClick={() => router.push('/students')} className={styles.backButton}>
                    <FaArrowLeft style={{ marginRight: '0.5rem' }} />返回列表
                </button>
            </div>

            {error && <div className={styles.errorAlert}>{error}</div>}

            <div className={styles.formCard}>
                <div className={styles.cardHeader}>
                    <h5>学生信息</h5>
                </div>
                <div className={styles.cardBody}>
                    <form onSubmit={handleSubmit}>
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label htmlFor="student_id" className={styles.required}>学号</label>
                                <input type="text" id="student_id" name="student_id" value={formData.student_id} onChange={handleChange} required />
                                {fieldErrors.student_id && <span className={styles.fieldError}>{fieldErrors.student_id}</span>}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="name" className={styles.required}>姓名</label>
                                <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
                                {fieldErrors.name && <span className={styles.fieldError}>{fieldErrors.name}</span>}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="grade_level" className={styles.required}>年级</label>
                                <select id="grade_level" name="grade_level" value={formData.grade_level} onChange={handleChange} required>
                                    <option value="">请选择年级</option>
                                    {GRADE_LEVEL_CHOICES.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                                </select>
                                {fieldErrors.grade_level && <span className={styles.fieldError}>{fieldErrors.grade_level}</span>}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="class_name" className={styles.required}>班级</label>
                                <select id="class_name" name="class_name" value={formData.class_name} onChange={handleChange} required>
                                    <option value="">请选择班级</option>
                                    {CLASS_NAME_CHOICES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {fieldErrors.class_name && <span className={styles.fieldError}>{fieldErrors.class_name}</span>}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="gender">性别</label>
                                <select id="gender" name="gender" value={formData.gender} onChange={handleChange}>
                                    <option value="男">男</option>
                                    <option value="女">女</option>
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="status">学籍状态</label>
                                <select id="status" name="status" value={formData.status} onChange={handleChange}>
                                    {STATUS_CHOICES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="date_of_birth">出生日期</label>
                                <input type="date" id="date_of_birth" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} />
                                {fieldErrors.date_of_birth && <span className={styles.fieldError}>{fieldErrors.date_of_birth}</span>}
                            </div>
                        </div>

                        <div className={styles.formActions}>
                            <button type="submit" className={styles.submitButton} disabled={isSaving}>
                                <FaSave style={{ marginRight: '0.5rem' }} />
                                {isSaving ? '正在保存...' : '保存更改'}
                            </button>
                            <button type="button" onClick={() => router.back()} className={styles.cancelButton}>
                                <FaTimes style={{ marginRight: '0.5rem' }} />取消
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditStudentPage;
