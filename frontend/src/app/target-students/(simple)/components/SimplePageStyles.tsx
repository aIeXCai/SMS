export default function SimplePageStyles() {
  return (
    <style jsx global>{`
      .analysis-card {
        border: none;
        border-radius: 15px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
      .analysis-card .card-body {
        padding: 2rem;
        text-align: center;
      }
      .analysis-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1rem;
      }
      .analysis-icon i {
        font-size: 1.75rem;
        color: #2e7d32;
      }
      .target-student-intro .card-title {
        color: #2e7d32;
        font-weight: 600;
      }
    `}</style>
  );
}
