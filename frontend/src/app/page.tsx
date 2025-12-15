"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";

export default function DashboardPage() {
  const { user, logout, loading } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e9ecef',
            borderTop: '4px solid #01876c',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#666' }}>加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        padding: '2rem'
      }}>
        <div style={{
          textAlign: 'center',
          backgroundColor: 'white',
          padding: '3rem',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          maxWidth: '400px',
          width: '100%'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#01876c',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <i style={{ color: 'white', fontSize: '24px' }}>🎓</i>
          </div>
          <h1 style={{ margin: '0 0 1rem 0', color: '#333', fontSize: '1.5rem' }}>
            白云实验学校管理系统
          </h1>
          <p style={{ margin: '0 0 2rem 0', color: '#666' }}>
            请先登录以使用系统功能
          </p>
          <a
            href="/login"
            style={{
              display: 'inline-block',
              padding: '0.75rem 2rem',
              backgroundColor: '#01876c',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#016155';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#01876c';
            }}
          >
            立即登录
          </a>
        </div>
      </div>
    );
  }

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'admin': return '管理员';
      case 'grade_manager': return '级长';
      case 'subject_teacher': return '科任老师';
      default: return '教辅人员';
    }
  };

  const getQuickActions = () => {
    // 获取当前主机名，如果是在服务端渲染则默认为 localhost
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const backendBaseUrl = `http://${hostname}:8000`;

    const actions = [
      {
        href: `${backendBaseUrl}/students/`,
        label: '学生信息',
        icon: '👥',
        description: '查看和管理学生档案'
      }
    ];

    if (user.role === 'admin' || user.role === 'grade_manager') {
      actions.push(
        {
          href: `${backendBaseUrl}/exams/`,
          label: '考试管理',
          icon: '📝',
          description: '创建和安排考试'
        },
        {
          href: `${backendBaseUrl}/scores/`,
          label: '成绩录入',
          icon: '📊',
          description: '录入学生成绩'
        },
        {
          href: `${backendBaseUrl}/scores/query/`,
          label: '成绩查询',
          icon: '🔍',
          description: '查询学生成绩'
        }
      );
    }

    if (user.role === 'admin') {
      actions.push({
        href: `${backendBaseUrl}/admin/`,
        label: '系统管理',
        icon: '⚙️',
        description: '系统配置和用户管理'
      });
    }

    return actions;
  };

  const quickActions = getQuickActions();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      fontFamily: "'Microsoft YaHei', Arial, sans-serif"
    }}>
      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '220px',
        height: '100vh',
        backgroundColor: 'white',
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        overflowY: 'auto'
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 15px',
          borderBottom: '1px solid #e9ecef'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              backgroundColor: '#01876c',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '8px'
            }}>
              <span style={{ color: 'white', fontSize: '12px' }}>🎓</span>
            </div>
            白云实验学校管理系统
          </div>
        </div>

        {/* User Info */}
        <div style={{
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: '#01876c',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px'
          }}>
            <span style={{ color: 'white', fontSize: '16px' }}>👤</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{
              margin: 0,
              fontWeight: '600',
              color: '#333',
              fontSize: '14px'
            }}>
              {user.first_name || user.username}
            </p>
            <p style={{
              margin: 0,
              color: '#666',
              fontSize: '12px'
            }}>
              {getRoleDisplay(user.role)}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ padding: '15px 0' }}>
          <div style={{ padding: '0 15px 8px 15px' }}>
            <h6 style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '0 0 12px 0'
            }}>
              主要功能
            </h6>
          </div>

          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 15px',
              margin: '0 15px',
              color: '#01876c',
              backgroundColor: '#e8f5f3',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              marginBottom: '4px'
            }}
          >
            <span style={{ width: '20px', marginRight: '12px', textAlign: 'center' }}>📊</span>
            Dashboard
          </a>

          <div style={{ padding: '15px 15px 8px 15px', marginTop: '15px' }}>
            <h6 style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '0 0 12px 0'
            }}>
              教学管理
            </h6>
          </div>

          {quickActions.map((action, index) => (
            <a
              key={index}
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 15px',
                margin: '0 15px',
                color: '#666',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
                e.currentTarget.style.color = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#666';
              }}
            >
              <span style={{ width: '20px', marginRight: '12px', textAlign: 'center' }}>
                {action.icon}
              </span>
              {action.label}
            </a>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginLeft: '220px', padding: '30px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '24px',
              color: '#333',
              fontWeight: '600'
            }}>
              Dashboard
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              color: '#666',
              fontSize: '14px'
            }}>
              {currentDate.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button style={{
              padding: '8px',
              backgroundColor: 'white',
              border: '1px solid #e9ecef',
              borderRadius: '8px',
              cursor: 'pointer'
            }}>
              🔔
            </button>
            <button style={{
              padding: '8px',
              backgroundColor: 'white',
              border: '1px solid #e9ecef',
              borderRadius: '8px',
              cursor: 'pointer'
            }}>
              📧
            </button>
            <button
              onClick={logout}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              登出
            </button>
          </div>
        </div>

        {/* Announcement Banner */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid #e9ecef',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
              📢 系统公告
            </h3>
            <p style={{ margin: '0 0 16px 0', opacity: 0.9, fontSize: '14px' }}>
              欢迎 {user.first_name || user.username}，您的工作台已准备就绪！
            </p>
            <button style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer'
            }}>
              查看详情
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '24px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
              学生总数
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '24px', fontWeight: '600', color: '#333' }}>
                1,284
              </span>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#e8f5f3',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ color: '#01876c', fontSize: '18px' }}>👥</span>
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
              班级数量
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '24px', fontWeight: '600', color: '#333' }}>
                42
              </span>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#fff3e8',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ color: '#ff8c00', fontSize: '18px' }}>🏫</span>
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
              本月考试
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '24px', fontWeight: '600', color: '#333' }}>
                8
              </span>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#f3e8ff',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ color: '#8b5cf6', fontSize: '18px' }}>📝</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: '24px'
        }}>
          {/* Quick Actions */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#333' }}>
              快捷操作
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {quickActions.map((action, index) => (
                <a
                  key={index}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '16px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all 0.2s',
                    border: '1px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e8f5f3';
                    e.currentTarget.style.borderColor = '#01876c';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{ fontSize: '18px', marginRight: '8px' }}>
                      {action.icon}
                    </span>
                    <h4 style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#333'
                    }}>
                      {action.label}
                    </h4>
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    {action.description}
                  </p>
                </a>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>
                今日日程
              </h3>
              <button style={{
                padding: '4px 8px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#01876c',
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                查看全部
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { time: '09:00 - 10:30', subject: '高二数学', class: '高二(3)班', type: 'class' },
                { time: '14:00 - 15:30', subject: '成绩录入', class: '期中考试', type: 'task' },
                { time: '16:00 - 17:00', subject: '家长会议', class: '高三年级', type: 'meeting' }
              ].map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px 0',
                    borderBottom: index < 2 ? '1px solid #f1f3f4' : 'none'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: item.type === 'class' ? '#01876c' :
                        item.type === 'task' ? '#ff8c00' : '#8b5cf6',
                      marginRight: '8px'
                    }}></div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#333'
                    }}>
                      {item.subject}
                    </span>
                  </div>
                  <p style={{
                    margin: '4px 0 0 16px',
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    {item.time}
                  </p>
                  <p style={{
                    margin: '2px 0 0 16px',
                    fontSize: '12px',
                    color: '#999'
                  }}>
                    {item.class}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grade Info for Grade Managers */}
        {user.role === 'grade_manager' && user.managed_grade && (
          <div style={{
            marginTop: '24px',
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
              年级信息
            </h3>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#01876c',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '16px'
              }}>
                <span style={{ color: 'white', fontSize: '20px' }}>🎓</span>
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: '#333' }}>
                  负责年级: {user.managed_grade}
                </h4>
                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                  您正在管理 {user.managed_grade} 的所有班级和学生
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
          }
          .main-content {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  );
}