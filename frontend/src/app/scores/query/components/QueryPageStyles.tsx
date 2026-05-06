export default function QueryPageStyles() {
  return (
    <style jsx global>{`
      .page-header {
        background: rgb(1, 135, 108);
        color: white;
        padding: 2rem 0;
        margin-bottom: 2rem;
        border-radius: 10px;
      }
      .stats-summary {
        background: white;
        border-radius: 12px;
        padding: 1rem 1.25rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        margin-bottom: 1rem;
      }
      .stats-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #e8f7f4;
        color: #01876c;
      }
      .query-table-scroll {
        scroll-behavior: smooth;
        overscroll-behavior-x: contain;
      }
      .frozen-table tbody tr:nth-child(odd) td {
        background-color: #f8fafa;
      }
      .frozen-table tbody tr:nth-child(even) td {
        background-color: #ffffff;
      }
      .frozen-table tbody tr:hover td {
        background-color: #e8f7f4 !important;
        transition: background-color 0.2s ease;
      }
      .frozen-table thead th {
        background: linear-gradient(135deg, #01876c 0%, #02a888 100%) !important;
        color: #ffffff;
        font-weight: 600;
        border-bottom: 1px solid #017a63;
      }
      .sort-header { white-space: nowrap; }
      .sort-btn {
        border: none;
        background: transparent;
        color: rgba(255,255,255,0.65);
        font-size: 0.82rem;
        margin-left: 0.25rem;
        padding: 0;
      }
      .sort-btn.active { color: #ffffff; font-weight: 700; }
      .frozen-col { position: sticky; left: 0; background: inherit; z-index: 2; }
      .frozen-table thead .frozen-col {
        background: linear-gradient(135deg, #01876c 0%, #02a888 100%) !important;
        z-index: 3;
      }
      .frozen-table tbody .frozen-col { background-color: #f8fafa; }
      .frozen-table tbody tr:nth-child(even) .frozen-col { background-color: #ffffff; }
      .frozen-table tbody tr:hover .frozen-col { background-color: #e8f7f4 !important; }
      .frozen-table .col-name { min-width: 96px; width: 96px; max-width: 96px; left: 0; }
      .frozen-table .col-grade { min-width: 72px; width: 72px; max-width: 72px; left: 96px; }
      .frozen-table .col-class { min-width: 72px; width: 72px; max-width: 72px; left: 168px; }
      .frozen-table .col-exam { min-width: 220px; width: 220px; max-width: 220px; left: 240px; }
      .frozen-table td.col-exam, .frozen-table th.col-exam { overflow: hidden; }
      .exam-text {
        display: block; width: 100%; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
      }
      .score-cell { text-align: center; font-size: 0.88rem; color: #1e2a25; }
      .frozen-table tbody td.total-score {
        font-weight: 700; color: #92400e;
        background-color: #fef3c7 !important;
      }
      .frozen-table tbody td.rank-cell {
        font-weight: 600; color: #0369a1;
        background-color: #d4e8fc !important;
      }
      .frozen-table tbody tr:hover td.total-score { background-color: #fde68a !important; }
      .frozen-table tbody tr:hover td.rank-cell { background-color: #b8d4f0 !important; }
      .empty-state {
        text-align: center; background: #fff;
        border-radius: 12px; padding: 3rem 1rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .empty-state i { font-size: 2.25rem; color: #adb5bd; }
      .frozen-table tbody td { font-weight: 400; }
      .subject-dropdown { position: relative; }
      .subject-dropdown-items { padding: 0.5rem 0.75rem; }
      .subject-dropdown-item { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; }
    `}</style>
  );
}
