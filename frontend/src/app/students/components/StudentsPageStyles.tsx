// Extracted styles for the students management page
// Renders the global <style jsx> block to keep page.tsx under 300 lines

export default function StudentsPageStyles() {
  return (
    <style jsx global>{`
      .page-header {
        background: rgb(1,135, 108);
        color: white;
        padding: 2rem 0;
        margin-bottom: 2rem;
        border-radius: 10px;
      }

      .page-header h1 {
        margin: 0;
        font-weight: 600;
      }

      .stats-card {
        background: linear-gradient(135deg, rgb(1,135,108) 0%, rgb(1,105,85) 100%);
        border: none;
        border-radius: 15px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: transform 0.3s ease;
      }

      .stats-card:hover {
        transform: translateY(-5px);
      }

      .stats-card .card-body {
        padding: 1.5rem;
      }

      .stats-icon {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        color: white;
      }

      .filter-card {
        border: none;
        border-radius: 15px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        margin-bottom: 2rem;
        overflow: visible !important;
      }

      .filter-card .card-header {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-bottom: 1px solid #dee2e6;
        border-radius: 15px 15px 0 0;
        padding: 1rem 1.5rem;
        font-weight: 600;
      }

      .filter-card .card-body {
        overflow: visible !important;
      }

      .filter-card .card-body > .row {
        overflow: visible !important;
        flex-wrap: wrap;
      }

      .filter-card .card-body > .row > [class*="col-"] {
        overflow: visible !important;
      }

      .batch-operations-card {
        border: none;
        border-radius: 15px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        margin-bottom: 2rem;
        border-left: 4px solid #28a745;
      }

      .batch-operations-card .card-header {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-bottom: 1px solid #dee2e6;
        border-radius: 15px 15px 0 0;
        padding: 1rem 1.5rem;
        font-weight: 600;
      }

      .btn-action {
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
        border-radius: 20px;
        margin-right: 0.25rem;
      }

      .status-badge {
        padding: 0.375rem 0.75rem;
        border-radius: 20px;
        font-size: 0.82rem;
        font-weight: 500;
      }

      .status-在读 {
        background-color: #e8f7f4;
        color: #01876c;
        border: 1px solid #b8ddd5;
      }

      .status-休学 {
        background-color: #fef3c7;
        color: #92400e;
        border: 1px solid #fde68a;
      }

      .status-退学 {
        background-color: #fee2e2;
        color: #dc2626;
        border: 1px solid #fecaca;
      }

      .status-毕业 {
        background-color: #e8f4fc;
        color: #0369a1;
        border: 1px solid #b8d4f0;
      }

      .quick-actions {
        background: #f8f9fa;
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 1rem;
      }

      .quick-actions .btn {
        margin-right: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .empty-state {
        text-align: center;
        padding: 3rem;
        color: #6c757d;
      }

      .empty-state i {
        font-size: 4rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      @media (max-width: 768px) {
        .page-header {
          padding: 1rem 0;
          margin-bottom: 1rem;
        }

        .stats-card {
          margin-bottom: 1rem;
        }

        .table-responsive {
          font-size: 0.875rem;
        }

        .btn-action {
          padding: 0.125rem 0.25rem;
          font-size: 0.75rem;
        }
      }

      /* Custom dropdown styles */
      .custom-dropdown {
        position: relative;
        width: 100%;
        color: #495057;
      }
      .filter-card .form-control,
      .filter-card .custom-dropdown-toggle {
        height: 38px !important;
        padding: 0.375rem 0.75rem !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
      }
      .custom-dropdown-toggle {
        width: 100%;
        padding: 0.375rem 0.75rem;
        border: 1px solid #ced4da;
        border-radius: 0.375rem;
        background-color: #fff;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.2s ease;
        text-align: left;
        font-size: 14px;
      }
      .custom-dropdown-toggle:hover,
      .custom-dropdown-toggle.active {
        border-color: #007bff;
        box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
      }
      .custom-dropdown-arrow {
        transition: transform 0.2s ease;
        color: #6c757d;
        margin-left: auto;
      }
      .custom-dropdown-toggle.active .custom-dropdown-arrow {
        transform: rotate(180deg);
      }
      .custom-dropdown-menu {
        position: absolute;
        top: calc(100% + 2px);
        left: 0;
        width: 100%;
        min-width: 100%;
        background: white;
        border: 1px solid #ced4da;
        border-radius: 0.375rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1050;
        max-height: 250px;
        overflow-y: auto;
        display: none;
        box-sizing: border-box;
      }
      .custom-dropdown-menu.show {
        display: block;
      }
      .custom-dropdown-item {
        display: block;
        width: 100%;
        padding: 0.375rem 0.75rem;
        cursor: pointer;
        transition: background-color 0.15s ease;
        font-size: 14px;
        border: none;
        background: transparent;
        text-align: left;
        color: inherit;
      }
      .custom-dropdown-item:hover {
        background-color: #f8f9fa;
      }
    `}</style>
  );
}
