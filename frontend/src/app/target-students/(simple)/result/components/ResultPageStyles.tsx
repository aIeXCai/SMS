export default function ResultPageStyles() {
  return (
    <style jsx global>{`
      .page-header {
        background: rgb(1, 135, 108);
        color: white;
        padding: 2rem 0;
        margin-bottom: 2rem;
        border-radius: 10px;
      }
      a.secondary-action,
      a.secondary-action:link,
      a.secondary-action:visited,
      a.secondary-action:hover,
      a.secondary-action:active {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        min-width: 144px;
        padding: 0 16px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.72);
        color: #2f3a4b;
        font-size: 14px;
        text-decoration: none;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: all 0.2s ease;
        cursor: pointer;
      }
      a.secondary-action:hover {
        background: rgba(255, 255, 255, 0.9);
        color: #1a2535;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
      .filter-card .form-control,
      .filter-card .custom-dropdown-toggle {
        height: 38px;
        padding: 0.375rem 0.75rem;
        font-size: 14px;
      }
      .custom-dropdown {
        position: relative;
        width: 100%;
        color: #495057;
      }
      .custom-dropdown-toggle {
        width: 100%;
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
      .custom-dropdown-header {
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #e9ecef;
        background-color: #f8f9fa;
        border-radius: 0.375rem 0.375rem 0 0;
      }
      .custom-dropdown-items {
        padding: 0.25rem 0;
      }
      .custom-dropdown-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.375rem 0.75rem;
        cursor: pointer;
        transition: background-color 0.15s ease;
        font-size: 14px;
        border: none;
        background: transparent;
        text-align: left;
      }
      .custom-dropdown-item:hover {
        background-color: #f8f9fa;
      }
      .custom-dropdown-item input[type="checkbox"] {
        width: 16px;
        height: 16px;
        margin-right: 0.5rem;
      }
      .custom-dropdown-header .form-check,
      .custom-dropdown-item.form-check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0;
        padding-left: 0.75rem;
      }
      .custom-dropdown-header .form-check-input,
      .custom-dropdown-item.form-check .form-check-input {
        float: none;
        margin: 0;
        position: static;
        flex-shrink: 0;
      }
      .custom-dropdown-header .form-check-label,
      .custom-dropdown-item.form-check .form-check-label {
        margin: 0;
      }
      .text-muted {
        color: #6c757d !important;
      }
    `}</style>
  );
}
