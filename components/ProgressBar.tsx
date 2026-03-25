import React from 'react';

interface ProgressBarProps {
  percent: number
}

const ProgressBar = ({percent}: ProgressBarProps) => {
  const clampedPercent = Math.min(Math.max(percent, 0), 1);
  return (
    <div className="h-1 bg-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden">
      <div
        className="h-full rounded-sm relative"
        style={{
          width: `${clampedPercent * 100}%`,
          background: 'linear-gradient(90deg, var(--gold), var(--gold-bright))'
        }}
      >
        {clampedPercent > 0 && clampedPercent < 1 && (
          <div className="absolute right-0 top-[-3px] bottom-[-3px] w-[3px] rounded-sm" style={{background: 'var(--gold-bright)', boxShadow: '0 0 10px var(--gold)'}} />
        )}
      </div>
    </div>
  )
}
export default ProgressBar;
