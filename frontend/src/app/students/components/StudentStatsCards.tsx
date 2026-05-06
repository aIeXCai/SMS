"use client";

import { Stats } from "./types";

interface Props {
  stats: Stats | null;
}

export default function StudentStatsCards({ stats }: Props) {
  return (
    <div className="flex flex-wrap gap-4 mb-4">
      <div className="flex-1 min-w-[200px]">
        <div className="stats-card p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h5 className="text-lg font-bold text-white/80">学生总数</h5>
              <p className="text-2xl font-bold text-white mb-0">
                {stats ? stats.total_students : "--"}
              </p>
            </div>
            <div className="stats-icon bg-blue-500">
              <i className="fas fa-users"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-[200px]">
        <div className="stats-card p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h5 className="text-lg font-bold text-white/80">在读学生</h5>
              <p className="text-2xl font-bold text-white mb-0">
                {stats ? stats.active_students : "--"}
              </p>
            </div>
            <div className="stats-icon bg-green-500">
              <i className="fas fa-user-check"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-[200px]">
        <div className="stats-card p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h5 className="text-lg font-bold text-white/80">已毕业</h5>
              <p className="text-2xl font-bold text-white mb-0">
                {stats ? stats.graduated_students : "--"}
              </p>
            </div>
            <div className="stats-icon bg-cyan-500">
              <i className="fas fa-graduation-cap"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-[200px]">
        <div className="stats-card p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h5 className="text-lg font-bold text-white/80">休学</h5>
              <p className="text-2xl font-bold text-white mb-0">
                {stats ? stats.suspended_students : "--"}
              </p>
            </div>
            <div className="stats-icon bg-yellow-500">
              <i className="fas fa-user-slash"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
