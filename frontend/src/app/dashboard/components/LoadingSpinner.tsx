"use client";

export default function LoadingSpinner() {
  return (
    <div className="home-loading">
      <div className="home-spinner" />
      <style jsx>{`
        .home-loading {
          min-height: calc(100vh - 60px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .home-spinner {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          border: 3px solid rgba(9, 94, 76, 0.12);
          border-top-color: #0f766e;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
