import React from 'react';

interface MiniTableColumn {
  header: string;
  accessor: string;
  align?: 'left' | 'right' | 'center';
  format?: (value: any) => React.ReactNode;
}

interface MiniTableProps {
  title: string;
  data: any[];
  columns: MiniTableColumn[];
  emptyMessage?: string;
  className?: string;
}

export function MiniTable({ title, data, columns, emptyMessage = 'Nenhum dado encontrado', className = '' }: MiniTableProps) {
  return (
    <div 
      style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        borderRadius: '20px',
        border: '1px solid var(--color-outline-variant)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        ...((className as any)?.style || {})
      }}
      className={className}
    >
      <div style={{ 
        backgroundColor: 'rgba(0,0,0,0.02)', 
        padding: '12px 20px', 
        borderBottom: '1px solid var(--color-outline-variant)' 
      }}>
        <h3 style={{ 
          fontSize: '12px', 
          fontWeight: 800, 
          color: 'var(--color-on-surface-variant)', 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em',
          margin: 0
        }}>
          {title}
        </h3>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  style={{ 
                    padding: '12px 20px', 
                    textAlign: col.align || 'left',
                    color: 'var(--color-outline)',
                    fontWeight: 500,
                    fontSize: '12px',
                    borderBottom: '1px solid var(--color-surface-container)'
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data || data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-outline)', fontStyle: 'italic' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover-bg-low" style={{ borderBottom: '1px solid var(--color-surface-container-low)', transition: 'background-color 0.2s' }}>
                  {columns.map((col, colIdx) => (
                    <td 
                      key={colIdx} 
                      style={{ 
                        padding: '16px 20px', 
                        textAlign: col.align || 'left',
                        color: 'var(--color-on-surface)',
                        fontWeight: 500
                      }}
                    >
                      {col.format ? col.format(row[col.accessor]) : row[col.accessor]}
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
