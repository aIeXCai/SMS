"use client";

import Link from "next/link";

export interface HeroPanelProps {
  displayName: string;
  roleTitle: string;
  summaryText: string;
  coverageLabel: string;
  coverageValue: string;
  latestExamAnalysisHref: string;
}

export default function HeroPanel({
  displayName,
  roleTitle,
  summaryText,
  coverageLabel,
  coverageValue,
  latestExamAnalysisHref,
}: HeroPanelProps) {
  return (
    <section className="hero-panel">
      <div className="hero-copy">
        <span className="hero-kicker">工作台</span>
        <h1>今天先把最重要的事做完。</h1>
        <p>{summaryText}</p>
        <div className="hero-actions">
          <Link href="/scores" className="primary-action">
            录入成绩
          </Link>
          <Link href={latestExamAnalysisHref} className="secondary-action">
            查看最近考试
          </Link>
        </div>
      </div>
      <div className="hero-side">
        <div className="identity-card">
          <span className="identity-label">{roleTitle}</span>
          <strong>{displayName}</strong>
          <div className="identity-metric">
            <span className="identity-metric-label">{coverageLabel}</span>
            <span className="identity-metric-value">{coverageValue}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero-panel {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 2.1fr) minmax(280px, 0.9fr);
          gap: 20px;
          padding: 28px;
          border-radius: 28px;
          overflow: hidden;
          background:
            radial-gradient(circle at top right, rgba(92, 111, 255, 0.12), transparent 26%),
            radial-gradient(circle at bottom left, rgba(255, 255, 255, 0.72), transparent 30%),
            linear-gradient(145deg, #f7f8fb 0%, #eef1f6 52%, #e8edf3 100%);
          border: 1px solid rgba(112, 125, 149, 0.18);
          box-shadow: 0 24px 64px rgba(29, 38, 52, 0.08);
        }

        .hero-panel::after {
          content: "";
          position: absolute;
          inset: auto -80px -140px auto;
          width: 260px;
          height: 260px;
          border-radius: 999px;
          background: rgba(77, 92, 122, 0.08);
          filter: blur(6px);
        }

        .hero-copy,
        .hero-side {
          position: relative;
          z-index: 1;
        }

        .hero-kicker {
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #58677d;
        }

        .hero-copy h1 {
          margin: 10px 0 0;
          font-size: 34px;
          line-height: 1.05;
          font-weight: 700;
          color: #141922;
        }

        .hero-copy p {
          margin: 16px 0 0;
          max-width: 620px;
          font-size: 16px;
          line-height: 1.7;
          color: #5d6778;
        }

        .hero-side {
          display: grid;
          gap: 16px;
          align-content: space-between;
        }

        .identity-card {
          background: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(255, 255, 255, 0.72);
          box-shadow: 0 18px 40px rgba(26, 33, 46, 0.06);
          display: grid;
          gap: 6px;
          padding: 18px 20px;
          border-radius: 22px;
        }

        .identity-label {
          font-size: 12px;
          color: #7a8698;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .identity-card strong {
          font-size: 22px;
          color: #151b25;
        }

        .identity-card span:last-child {
          color: #5e6878;
        }

        .identity-metric {
          display: grid;
          gap: 4px;
          margin-top: 10px;
          padding-top: 12px;
          border-top: 1px solid rgba(106, 118, 138, 0.16);
        }

        .identity-metric-label {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #7a8698;
        }

        .identity-metric-value {
          font-size: 14px;
          line-height: 1.6;
          color: #273142;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 20px;
        }

        :global(a.primary-action),
        :global(a.secondary-action) {
          text-decoration: none;
          transition: all 0.2s ease;
        }

        :global(a.primary-action),
        :global(a.primary-action:link),
        :global(a.primary-action:visited),
        :global(a.primary-action:hover),
        :global(a.primary-action:active) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          min-width: 124px;
          padding: 0 16px;
          border-radius: 12px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent),
            linear-gradient(135deg, #161b24 0%, #242c39 54%, #30384a 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          text-decoration: none !important;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 10px 18px rgba(20, 27, 37, 0.14);
        }

        :global(a.secondary-action),
        :global(a.secondary-action:link),
        :global(a.secondary-action:visited),
        :global(a.secondary-action:hover),
        :global(a.secondary-action:active) {
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
          font-weight: 600;
          letter-spacing: -0.01em;
          text-decoration: none !important;
          border: 1px solid rgba(115, 128, 151, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.52),
            0 8px 16px rgba(34, 44, 62, 0.05);
          backdrop-filter: blur(10px);
        }

        :global(a.primary-action:hover) {
          transform: translateY(-1px);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 12px 22px rgba(20, 27, 37, 0.18);
        }

        :global(a.secondary-action:hover) {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.84);
          border-color: rgba(91, 104, 127, 0.22);
        }

        @media (max-width: 768px) {
          .hero-panel {
            padding: 18px;
            border-radius: 20px;
            grid-template-columns: 1fr;
          }

          .hero-copy h1 {
            font-size: 28px;
          }
        }
      `}</style>
    </section>
  );
}
