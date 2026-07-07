"use client";

import type { AIResultTableData } from "./types";

interface AIResultTableProps {
  table: AIResultTableData;
}

export function AIResultTable({ table }: AIResultTableProps) {
  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">
        {table.title}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-3 py-2 font-medium ${
                    column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.rows.length === 0 ? (
              <tr>
                <td colSpan={table.columns.length} className="px-3 py-4 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            ) : (
              table.rows.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {table.columns.map((column) => (
                    <td
                      key={column.key}
                      className={`whitespace-nowrap px-3 py-2 text-gray-700 ${
                        column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"
                      }`}
                    >
                      {row[column.key] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

