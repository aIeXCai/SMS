// Extracted styles for the exams list page
export default function ExamsPageStyles() {
  return (
    <style jsx global>{`
      .page-header {
        background: rgb(1, 135, 108);
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

      @media (max-width: 768px) {
        .page-header {
          padding: 1rem 0;
          margin-bottom: 1rem;
        }

        .stats-card {
          margin-bottom: 1rem;
        }
      }
    `}</style>
  );
}
