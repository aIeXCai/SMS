export default function AddPageStyles() {
  return (
    <style jsx global>{`
      .page-header {
        background: linear-gradient(135deg, rgb(1, 135, 108), #02a888);
        color: white;
        padding: 2rem 0;
        margin-bottom: 2rem;
        border-radius: 10px;
      }
      .page-header h1 {
        margin: 0;
        font-weight: 600;
      }
      .form-card {
        background: white;
        border-radius: 15px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: visible;
        margin-bottom: 2rem;
      }
      .form-card-header {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        padding: 1.5rem;
        border-bottom: 1px solid #dee2e6;
      }
      .form-card-body {
        padding: 2rem;
        overflow: visible;
      }
      .help-alert {
        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
        border: none;
        border-radius: 10px;
        color: #1565c0;
        padding: 1rem;
        margin-bottom: 2rem;
      }
      .btn-save {
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        border: none;
        padding: 0.75rem 2rem;
        font-weight: 600;
        border-radius: 10px;
        color: white;
      }
      .btn-cancel {
        background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
        border: none;
        padding: 0.75rem 2rem;
        font-weight: 600;
        border-radius: 10px;
        color: white;
      }
    `}</style>
  );
}
