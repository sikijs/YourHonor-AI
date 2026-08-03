'use client';

export const WAIT_NOTICE_THRESHOLD = 30;

export default function LoadingStatus({ message, elapsed }: { message: string; elapsed: number }) {
  return (
    <div className="spinner-container">
      <span className="spinner" />
      <p>
        {message} ({elapsed}s)
        {elapsed >= WAIT_NOTICE_THRESHOLD && (
          <span className="wait-inline">Taking time to retrieve data -- hang on</span>
        )}
      </p>
    </div>
  );
}
