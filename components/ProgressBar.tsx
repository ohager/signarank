import React from 'react';
import styles from '../styles/ProgressBar.module.css';

interface ProgressBarProps {
  percent: number
}

const ProgressBar = ({
  percent
}: ProgressBarProps) => (
  <div className={styles.outer}>
    <div style={{ width: `${100 - (percent * 100)}%` }} className={styles.inner}></div>
  </div>
)
export default ProgressBar;