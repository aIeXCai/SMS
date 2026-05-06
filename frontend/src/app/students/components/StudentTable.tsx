"use client";

import Link from "next/link";
import { Student, Stats } from "./types";

interface Props {
  students: Student[];
  stats: Stats | null;
  selected: Record<number, boolean>;
  allSelected: boolean;
  canStudentWrite: boolean;
  isLoading: boolean;
  onSelectAll: () => void;
  onSelectOne: (id: number) => void;
  onDelete: (student: Student) => void;
  onStatusChange: (studentId: number, newStatus: string, currentStatus?: string) => void;
}

function StudentRow({
  student,
  stats,
  selected,
  canStudentWrite,
  onSelectOne,
  onDelete,
  onStatusChange,
}: {
  student: Student;
  stats: Stats | null;
  selected: Record<number, boolean>;
  canStudentWrite: boolean;
  onSelectOne: (id: number) => void;
  onDelete: (student: Student) => void;
  onStatusChange: (studentId: number, newStatus: string, currentStatus?: string) => void;
}) {
  const statusClass = `status-badge status-${student.status}`;

  return (
    <tr>
      <td>
        {canStudentWrite && (
          <div className="flex items-center gap-2">
            <input
              className="rounded border-gray-300"
              type="checkbox"
              checked={Boolean(selected[student.id])}
              onChange={() => onSelectOne(student.id)}
            />
          </div>
        )}
      </td>
      <td>
        <span className="font-bold" style={{ color: '#1e2a25', fontSize: '0.9rem' }}>{student.student_id}</span>
      </td>
      <td>
        <span className="font-medium" style={{ color: '#1e2a25', fontSize: '0.9rem' }}>{student.name}</span>
      </td>
      <td>
        {student.gender === "男" ? (
          <span className="inline-block rounded-full px-3 py-2 text-xs" style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.88rem' }}>
            <i className="fas fa-mars mr-1"></i>
            {student.gender}
          </span>
        ) : (
          <span className="inline-block rounded-full px-3 py-2 text-xs" style={{ background: '#fce7f3', color: '#be185d', border: '1px solid #f9a8d4', fontSize: '0.88rem' }}>
            <i className="fas fa-venus mr-1"></i>
            {student.gender || "-"}
          </span>
        )}
      </td>
      <td>
        {student.current_class ? (
          <span className="inline-block rounded-full px-3 py-2 text-xs" style={{ background: '#e8f7f4', color: '#01876c', border: '1px solid #b8ddd5', fontSize: '0.88rem' }}>{student.current_class.cohort}</span>
        ) : (
          <span style={{ color: '#8fa398' }}>-</span>
        )}
      </td>
      <td>
        {student.current_class ? (
          <span className="inline-block rounded-full px-3 py-2 text-xs" style={{ background: '#d4e8fc', color: '#0369a1', border: '1px solid #a0c4e8', fontSize: '0.88rem' }}>{student.current_class.grade_level}</span>
        ) : (
          <span style={{ color: '#8fa398' }}>-</span>
        )}
      </td>
      <td>
        {student.current_class ? (
          <span className="inline-block rounded-full px-3 py-2 text-xs" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.88rem' }}>{student.current_class.class_name}</span>
        ) : (
          <span style={{ color: '#8fa398' }}>未分配</span>
        )}
      </td>
      <td>
        <span className={statusClass}>{student.status}</span>
      </td>
      <td>
        {canStudentWrite ? (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            <a
              href={`/students/${student.id}/edit/`}
              className="text-sm px-2 py-1 rounded"
              style={{ background: '#b8ddd5', color: '#015a4a', border: '1px solid #8cd4c4' }}
              title="编辑学生信息"
            >
              <i className="fas fa-edit"></i>
            </a>
            <button
              type="button"
              className="text-sm px-2 py-1 rounded"
              style={{ background: '#fecaca', color: '#b91c1c', border: '1px solid #fca5a5' }}
              title="删除学生"
              onClick={() => onDelete(student)}
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        ) : (
          <span className="text-gray-500">只读</span>
        )}
      </td>
      {canStudentWrite && (
        <td>
          <div className="flex items-center gap-2">
            <select
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
              style={{ minWidth: "100px" }}
              value={student.status}
              onChange={(e) => onStatusChange(student.id, e.target.value, student.status)}
            >
              {stats?.status_choices.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="border border-green-600 text-green-600 text-sm px-2 py-1 rounded hover:bg-green-50 transition-colors"
              title="更新状态"
              onClick={() => onStatusChange(student.id, student.status, student.status)}
            >
              <i className="fas fa-check"></i>
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

export default function StudentTable({
  students,
  stats,
  selected,
  allSelected,
  canStudentWrite,
  isLoading,
  onSelectAll,
  onSelectOne,
  onDelete,
  onStatusChange,
}: Props) {
  return (
    <div className="app-table-wrapper">
      {isLoading ? (
        <div className="text-center py-5">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" role="status"></div>
        </div>
      ) : students.length ? (
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>
                  <div className="flex items-center gap-2">
                    <input
                      className="rounded border-gray-300"
                      type="checkbox"
                      checked={allSelected}
                      onChange={onSelectAll}
                    />
                  </div>
                </th>
                <th>
                  <i className="fas fa-id-card mr-1"></i>学号
                </th>
                <th>
                  <i className="fas fa-user mr-1"></i>姓名
                </th>
                <th>
                  <i className="fas fa-venus-mars mr-1"></i>性别
                </th>
                <th>
                  <i className="fas fa-layer-group mr-1"></i>入学年份
                </th>
                <th>
                  <i className="fas fa-layer-group mr-1"></i>年级
                </th>
                <th>
                  <i className="fas fa-users mr-1"></i>班级
                </th>
                <th>
                  <i className="fas fa-info-circle mr-1"></i>状态
                </th>
                <th style={{ width: canStudentWrite ? 50 : 88 }}>
                  <i className="fas fa-cogs mr-1"></i>操作
                </th>
                {canStudentWrite && (
                  <th style={{ width: 50 }}>
                    <i className="fas fa-edit mr-1"></i>状态切换
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  stats={stats}
                  selected={selected}
                  canStudentWrite={canStudentWrite}
                  onSelectOne={onSelectOne}
                  onDelete={onDelete}
                  onStatusChange={onStatusChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <i className="fas fa-users"></i>
          <h4>暂无学生数据</h4>
          <p className="mb-3">还没有添加任何学生，点击下方按钮开始添加</p>
          {canStudentWrite ? (
            <Link href="/students/add" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
              <i className="fas fa-plus mr-1"></i>添加第一个学生
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
