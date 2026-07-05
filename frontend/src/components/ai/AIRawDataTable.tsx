"use client";

import { useMemo } from "react";

interface AIRawDataTableProps {
  data: Record<string, unknown> | null;
}

interface FlatRow {
  key: string;
  value: string;
  depth: number;
}

/**
 * Flatten a nested object into an array of { key, value, depth } rows.
 * Arrays are serialized as JSON strings.
 * Nested objects produce "key" as a header row (depth adds indent)
 * followed by their flattened children at depth+1.
 */
function flattenData(
  obj: Record<string, unknown>,
  depth: number = 0
): FlatRow[] {
  const rows: FlatRow[] = [];

  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) {
      rows.push({ key, value: "—", depth });
    } else if (Array.isArray(val)) {
      // For arrays of objects, flatten each item as a numbered sub-row
      if (val.length === 0) {
        rows.push({ key, value: "[]", depth });
      } else if (typeof val[0] === "object" && val[0] !== null) {
        rows.push({ key, value: `[${val.length} items]`, depth });
        val.forEach((item, idx) => {
          if (typeof item === "object" && item !== null) {
            const child = flattenData(item as Record<string, unknown>, depth + 1);
            // Add an index header
            child.unshift({ key: `[${idx}]`, value: "", depth: depth + 1 });
            rows.push(...child);
          } else {
            rows.push({ key: `[${idx}]`, value: String(item), depth: depth + 1 });
          }
        });
      } else {
        rows.push({ key, value: val.join(", "), depth });
      }
    } else if (typeof val === "object") {
      rows.push({ key, value: "", depth });
      rows.push(
        ...flattenData(val as Record<string, unknown>, depth + 1)
      );
    } else {
      rows.push({ key, value: String(val), depth });
    }
  }

  return rows;
}

export function AIRawDataTable({ data }: AIRawDataTableProps) {
  const rows = useMemo(() => {
    if (!data) return null;
    return flattenData(data);
  }, [data]);

  if (!data) {
    return (
      <div className="text-xs text-gray-400 py-2 text-center">
        无原始数据
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-2 text-center">
        数据为空
      </div>
    );
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-md border border-gray-200">
      <table className="w-full text-xs">
        <tbody>
          {rows.map((row, idx) => {
            const indentStyle = { paddingLeft: `${8 + row.depth * 16}px` };
            const isEmptyValue = row.value === "" || row.value === undefined;
            return (
              <tr
                key={idx}
                className={
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                }
              >
                <td
                  className={`py-1.5 pr-2 whitespace-nowrap ${
                    isEmptyValue
                      ? "font-semibold text-gray-700"
                      : "text-gray-500"
                  }`}
                  style={indentStyle}
                >
                  {row.key}
                </td>
                <td
                  className={`py-1.5 pl-2 text-gray-800 break-all ${
                    isEmptyValue ? "" : ""
                  }`}
                >
                  {row.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
