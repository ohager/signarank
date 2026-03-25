import React from 'react';

interface ProgressBarProps {
  percent: number
}

const ProgressBar = ({
  percent
}: ProgressBarProps) => (
  <div className="border border-[var(--main-color1)] w-full h-5 relative" style={{background: 'linear-gradient(to right, var(--main-color1), var(--main-color2), var(--main-color3), var(--main-color4), var(--main-color5))'}}>
    <div style={{ width: `${100 - (percent * 100)}%` }} className="border border-transparent bg-[var(--black)] h-full absolute right-0 top-0"></div>
  </div>
)
export default ProgressBar;
