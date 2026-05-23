const COLLEGE_NAME =
  import.meta.env.VITE_COLLEGE_NAME || 'College of Engineering'

export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label="Loading">
      <div className="page-loader__inner">
        <div className="page-loader__spinner" aria-hidden="true" />
        <p className="page-loader__title">{COLLEGE_NAME}</p>
        <p className="page-loader__subtitle">Loading…</p>
      </div>
      <style>{`
        .page-loader {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(160deg, #f8fafc 0%, #eef2ff 100%);
        }
        .page-loader__inner {
          text-align: center;
          padding: 2rem;
        }
        .page-loader__spinner {
          width: 3rem;
          height: 3rem;
          margin: 0 auto 1.25rem;
          border: 3px solid #e2e8f0;
          border-top-color: #4f46e5;
          border-radius: 50%;
          animation: page-loader-spin 0.75s linear infinite;
        }
        .page-loader__title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.35rem;
        }
        .page-loader__subtitle {
          font-size: 0.875rem;
          color: #64748b;
          margin: 0;
        }
        @keyframes page-loader-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
