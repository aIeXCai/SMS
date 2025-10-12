'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './StudentPage.module.css';
import { useRouter } from 'next/navigation';
import { FaSearch, FaUndo, FaUsers, FaUserCheck, FaGraduationCap, FaUserClock, FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import Link from 'next/link';

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


const StudentsPage = () => {
    const { user, isInitializing, isAuthenticated } = useAuth();
    const router = useRouter();
    const [students, setStudents] = useState<Student[]>([]);
    const [stats, setStats] = useState({ total: 0, active: 0, graduated: 0, suspended: 0 });
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [search, setSearch] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');
    const [status, setStatus] = useState('');
    const [className, setClassName] = useState('');

    const fetchStudentsAndStats = useCallback(async (queryParams: string) => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setError("用户未认证");
            setDataLoading(false);
            return;
        };
        setDataLoading(true);
        setError(null);

        try {
            // Fetch students
            const studentsResponse = await fetch(`http://127.0.0.1:8000/api/students/?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!studentsResponse.ok) throw new Error('获取学生数据失败');
            const studentsData = await studentsResponse.json();
            setStudents(studentsData);

            // For now, calculate stats on frontend. Later, we can move this to a backend endpoint.
            const total = studentsData.length;
            const active = studentsData.filter((s: Student) => s.status === '在读').length;
            const graduated = studentsData.filter((s: Student) => s.status === '毕业').length;
            const suspended = studentsData.filter((s: Student) => s.status === '休学').length;
            setStats({ total, active, graduated, suspended });

        } catch (err: any) {
            setError(err.message);
        } finally {
            setDataLoading(false);
        }
    }, []);

    const handleDelete = async (studentId: number) => {
        if (!window.confirm('您确定要删除这名学生吗？此操作不可撤销。')) {
            return;
        }

        const token = localStorage.getItem('accessToken');
        if (!token) {
            setError("认证失败，请重新登录。");
            return;
        }

        try {
            const response = await fetch(`http://127.0.0.1:8000/api/students/${studentId}/`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.status === 204) {
                // 删除成功，从前端状态中移除该学生
                setStudents(prevStudents => prevStudents.filter(student => student.id !== studentId));
                // 可以在这里重新计算统计数据或重新获取
            } else {
                const errorData = await response.json();
                throw new Error(errorData.detail || '删除失败');
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleEdit = (studentId: number) => {
        router.push(`/students/edit/${studentId}`);
    };

    useEffect(() => {
        if (!isInitializing && !isAuthenticated) {
            router.push('/login');
        } else if (isAuthenticated) {
            fetchStudentsAndStats('');
        }
    }, [isInitializing, isAuthenticated, router, fetchStudentsAndStats]);


    const handleSearch = () => {
        const query = new URLSearchParams();
        if (search) query.append('search', search);
        if (gradeLevel) query.append('grade_level', gradeLevel);
        if (status) query.append('status', status);
        if (className) query.append('current_class__class_name', className);
        fetchStudentsAndStats(query.toString());
    };

    const handleReset = () => {
        setSearch('');
        setGradeLevel('');
        setStatus('');
        setClassName('');
        fetchStudentsAndStats('');
    };


    if (isInitializing) {
        return <div className={styles.loading}>加载中...</div>;
    }

    if (!user) {
        return null;
    }

    const getStatusClassName = (status: string) => {
        switch (status) {
            case '在读': return styles.status_在读;
            case '休学': return styles.status_休学;
            case '转学': return styles.status_转学;
            case '毕业': return styles.status_毕业;
            case '复学': return styles.status_复学;
            default: return '';
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <h1><FaUsers style={{ marginRight: '1rem' }} />学生管理</h1>
                <div className={styles.headerActions}>
                    <Link href="/students/add" className={styles.actionButton}>
                        <FaPlus style={{ marginRight: '0.5rem' }} />新增学生
                    </Link>
                </div>
            </div>

            <div className={styles.statsContainer}>
                <div className={styles.statCard}>
                    <div className={styles.statCardContent}>
                        <div className={`${styles.statsIcon} ${styles['bg-primary']}`}><FaUsers /></div>
                        <div>
                            <h5>{stats.total}</h5>
                            <p>总学生数</p>
                        </div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statCardContent}>
                        <div className={`${styles.statsIcon} ${styles['bg-success']}`}><FaUserCheck /></div>
                        <div>
                            <h5>{stats.active}</h5>
                            <p>在校学生</p>
                        </div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statCardContent}>
                        <div className={`${styles.statsIcon} ${styles['bg-info']}`}><FaGraduationCap /></div>
                        <div>
                            <h5>{stats.graduated}</h5>
                            <p>毕业学生</p>
                        </div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statCardContent}>
                        <div className={`${styles.statsIcon} ${styles['bg-warning']}`}><FaUserClock /></div>
                        <div>
                            <h5>{stats.suspended}</h5>
                            <p>休学学生</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.filterContainer}>
                <div className={styles.filterHeader}>
                    <h5><FaSearch style={{ marginRight: '0.5rem' }} />筛选条件</h5>
                </div>
                <div className={styles.filterBody}>
                    <div className={styles.filterGroup}>
                        <label htmlFor="search-input">搜索 (学号/姓名)</label>
                        <input
                            id="search-input"
                            type="text"
                            placeholder="输入学号或姓名"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={styles.filterInput}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <div className={styles.filterGroup}>
                        <label htmlFor="class-select">班级</label>
                        <select id="class-select" value={className} onChange={(e) => setClassName(e.target.value)} className={styles.filterSelect}>
                            <option value="">所有班级</option>
                            {CLASS_NAME_CHOICES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label htmlFor="grade-select">年级</label>
                        <select id="grade-select" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className={styles.filterSelect}>
                            <option value="">所有年级</option>
                            {GRADE_LEVEL_CHOICES.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label htmlFor="status-select">状态</label>
                        <select id="status-select" value={status} onChange={(e) => setStatus(e.target.value)} className={styles.filterSelect}>
                            <option value="">所有状态</option>
                            {STATUS_CHOICES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterButtons}>
                        <button onClick={handleSearch} className={styles.filterButton}><FaSearch />筛选</button>
                        <button onClick={handleReset} className={styles.resetButton}><FaUndo />重置</button>
                    </div>
                </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}
            
            <div className={styles.tableContainer}>
                {dataLoading ? (
                    <div className={styles.loading}>正在加载学生数据...</div>
                ) : students.length > 0 ? (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>学号</th>
                                <th>姓名</th>
                                <th>性别</th>
                                <th>年级</th>
                                <th>班级</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((student) => (
                                <tr key={student.id}>
                                    <td>{student.student_id}</td>
                                    <td>{student.name}</td>
                                    <td>{student.gender}</td>
                                    <td>{student.grade_level}</td>
                                    <td>{student.current_class ? student.current_class.class_name : 'N/A'}</td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${getStatusClassName(student.status)}`}>
                                            {student.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button onClick={() => handleEdit(student.id)} className={`${styles.actionBtn} ${styles.editBtn}`}><FaEdit /> 编辑</button>
                                        <button onClick={() => handleDelete(student.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`}><FaTrash /> 删除</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className={styles.emptyState}>
                        <FaUsers />
                        <h4>暂无学生数据</h4>
                        <p>没有找到符合条件的学生记录。</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentsPage;