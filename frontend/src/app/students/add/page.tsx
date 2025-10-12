'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './add.module.css';
import { FaUserPlus, FaArrowLeft, FaSave, FaTimes } from 'react-icons/fa';

const GRADE_LEVEL_CHOICES = ['高一', '高二', '高三', '初一', '初二', '初三'];
const CLASS_NAME_CHOICES = Array.from({ length: 20 }, (_, i) => `${i + 1}班`);
const GENDER_CHOICES = ['男', '女'];
const STATUS_CHOICES = ['在读', '转学', '休学', '复学', '毕业'];

const AddStudentPage = () => {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [formData, setFormData] = useState({
        student_id: '',
        name: '',
        gender: '男',
        date_of_birth: '',
        grade_level: '',
        current_class_name: '',
        status: '在读',
        id_card_number: '',
        student_enrollment_number: '',
        home_address: '',
        guardian_name: '',
        guardian_contact_phone: '',
        entry_date: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAuthenticated) {
            setError('认证失败，请重新登录。');
            return;
        }
        setIsLoading(true);
        setError(null);
        setFieldErrors({});

        const token = localStorage.getItem('accessToken');

        // 构造要发送到后端的数据
        const payload = {
            ...formData,
            // 后端需要班级ID，而不是班级名称。我们需要先找到或创建班级。
            // 这是一个简化的例子，假设后端可以接受grade_level和class_name来找到或创建班级。
            // 在一个完整的实现中，您可能需要一个API端点来获取班级列表。
            current_class: {
                grade_level: formData.grade_level,
                class_name: formData.current_class_name,
            }
        };

        try {
            const response = await fetch('http://127.0.0.1:8000/api/students/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                // 创建成功
                router.push('/students');
            } else {
                const errorData = await response.json();
                if (response.status === 400) {
                    // 处理字段验证错误
                    setFieldErrors(errorData);
                    setError('请检查表单中的错误。');
                } else {
                    setError(errorData.detail || '创建学生失败。');
                }
            }
        } catch (err) {
            setError('网络错误，无法连接到服务器。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <h1><FaUserPlus style={{ marginRight: '1rem' }} />新增学生</h1>
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
                            {/* Student ID */}
                            <div className={styles.formGroup}>
                                <label htmlFor="student_id" className={styles.required}>学号</label>
                                <input type="text" id="student_id" name="student_id" value={formData.student_id} onChange={handleChange} required />
                                {fieldErrors.student_id && <span className={styles.fieldError}>{fieldErrors.student_id}</span>}
                            </div>

                            {/* Name */}
                            <div className={styles.formGroup}>
                                <label htmlFor="name" className={styles.required}>姓名</label>
                                <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
                                {fieldErrors.name && <span className={styles.fieldError}>{fieldErrors.name}</span>}
                            </div>

                            {/* Grade Level */}
                            <div className={styles.formGroup}>
                                <label htmlFor="grade_level" className={styles.required}>年级</label>
                                <select id="grade_level" name="grade_level" value={formData.grade_level} onChange={handleChange} required>
                                    <option value="">请选择年级</option>
                                    {GRADE_LEVEL_CHOICES.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                                {fieldErrors.grade_level && <span className={styles.fieldError}>{fieldErrors.grade_level}</span>}
                            </div>

                            {/* Class Name */}
                            <div className={styles.formGroup}>
                                <label htmlFor="current_class_name" className={styles.required}>班级</label>
                                <select id="current_class_name" name="current_class_name" value={formData.current_class_name} onChange={handleChange} required>
                                    <option value="">请选择班级</option>
                                    {CLASS_NAME_CHOICES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {fieldErrors.current_class && <span className={styles.fieldError}>{fieldErrors.current_class}</span>}
                            </div>

                            {/* Gender */}
                            <div className={styles.formGroup}>
                                <label htmlFor="gender">性别</label>
                                <select id="gender" name="gender" value={formData.gender} onChange={handleChange}>
                                    {GENDER_CHOICES.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>

                            {/* Status */}
                            <div className={styles.formGroup}>
                                <label htmlFor="status">在校状态</label>
                                <select id="status" name="status" value={formData.status} onChange={handleChange}>
                                    {STATUS_CHOICES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Date of Birth */}
                            <div className={styles.formGroup}>
                                <label htmlFor="date_of_birth">出生日期</label>
                                <input type="date" id="date_of_birth" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} />
                            </div>

                            {/* Entry Date */}
                            <div className={styles.formGroup}>
                                <label htmlFor="entry_date">入学日期</label>
                                <input type="date" id="entry_date" name="entry_date" value={formData.entry_date} onChange={handleChange} />
                            </div>

                            {/* ID Card Number */}
                            <div className={styles.formGroup}>
                                <label htmlFor="id_card_number">身份证号码</label>
                                <input type="text" id="id_card_number" name="id_card_number" value={formData.id_card_number} onChange={handleChange} />
                                {fieldErrors.id_card_number && <span className={styles.fieldError}>{fieldErrors.id_card_number}</span>}
                            </div>

                            {/* Student Enrollment Number */}
                            <div className={styles.formGroup}>
                                <label htmlFor="student_enrollment_number">学籍号</label>
                                <input type="text" id="student_enrollment_number" name="student_enrollment_number" value={formData.student_enrollment_number} onChange={handleChange} />
                                {fieldErrors.student_enrollment_number && <span className={styles.fieldError}>{fieldErrors.student_enrollment_number}</span>}
                            </div>

                            {/* Guardian Name */}
                            <div className={styles.formGroup}>
                                <label htmlFor="guardian_name">监护人姓名</label>
                                <input type="text" id="guardian_name" name="guardian_name" value={formData.guardian_name} onChange={handleChange} />
                            </div>

                            {/* Guardian Contact Phone */}
                            <div className={styles.formGroup}>
                                <label htmlFor="guardian_contact_phone">监护人联系电话</label>
                                <input type="text" id="guardian_contact_phone" name="guardian_contact_phone" value={formData.guardian_contact_phone} onChange={handleChange} />
                                {fieldErrors.guardian_contact_phone && <span className={styles.fieldError}>{fieldErrors.guardian_contact_phone}</span>}
                            </div>

                            {/* Home Address */}
                            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                                <label htmlFor="home_address">家庭地址</label>
                                <textarea id="home_address" name="home_address" value={formData.home_address} onChange={handleChange}></textarea>
                            </div>
                        </div>

                        <div className={styles.formActions}>
                            <button type="submit" className={styles.submitButton} disabled={isLoading}>
                                <FaSave style={{ marginRight: '0.5rem' }} />
                                {isLoading ? '正在保存...' : '保存学生信息'}
                            </button>
                            <button type="button" onClick={() => router.back()} className={styles.cancelButton}>
                                <FaTimes style={{ marginRight: '0.5rem' }} />
                                取消
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddStudentPage;
