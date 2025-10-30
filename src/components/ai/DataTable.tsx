'use client';

interface Column {
  key: string;
  label: string;
  format?: (value: any) => string;
}

interface DataTableProps {
  title?: string;
  description?: string;
  columns: Column[];
  data: any[];
  maxRows?: number;
}

export default function DataTable({ title, description, columns, data, maxRows = 10 }: DataTableProps) {
  const displayData = maxRows ? data.slice(0, maxRows) : data;

  const formatValue = (value: any, format?: (value: any) => string) => {
    if (value === null || value === undefined) return '-';
    if (format) return format(value);
    if (typeof value === 'number') {
      // Format as currency if it looks like money (has decimals or is large)
      if (value % 1 !== 0 || value > 999) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }).format(value);
      }
      return value.toLocaleString();
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') {
      // Handle nested objects (like agent names)
      if (value.first_name && value.last_name) {
        return `${value.first_name} ${value.last_name}`;
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {(title || description) && (
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          {title && <h3 className="font-semibold text-slate-900">{title}</h3>}
          {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200">
              {columns.map((column, idx) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider ${
                    idx === 0 ? 'sticky left-0 bg-slate-50 z-10' : ''
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayData.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="hover:bg-slate-50/50 transition-colors"
              >
                {columns.map((column, colIdx) => (
                  <td
                    key={`${rowIdx}-${column.key}`}
                    className={`px-6 py-4 text-sm text-slate-800 ${
                      colIdx === 0 ? 'sticky left-0 bg-white z-10 font-medium' : ''
                    }`}
                  >
                    {formatValue(row[column.key], column.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > displayData.length && (
        <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-200 text-center text-sm text-slate-600">
          Showing {displayData.length} of {data.length} rows
        </div>
      )}
    </div>
  );
}

